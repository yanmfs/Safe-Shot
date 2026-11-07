use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use percent_encoding::percent_decode_str;
use tauri::ipc::{InvokeBody, Request, Response};

const MAX_BYTES: u64 = 100 * 1024 * 1024;
const READABLE: [&str; 8] = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "heic", "heif"];
const WRITABLE: [&str; 3] = ["png", "jpg", "jpeg"];

#[derive(Debug, thiserror::Error)]
pub enum ImageError {
    #[error("unsupported file type")]
    UnsupportedType,
    #[error("file is larger than 100 MB")]
    TooLarge,
    #[error("HEIC needs macOS; export the photo as JPG first")]
    HeicUnsupported,
    #[error("could not convert the HEIC file")]
    HeicFailed,
    #[error("refusing to overwrite the original image")]
    WouldOverwriteOriginal,
    #[error("the request is missing its target path or data")]
    BadRequest,
    #[error("could not access the file: {0}")]
    Io(#[from] std::io::Error),
}

impl serde::Serialize for ImageError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default()
}

fn convert_heic(path: &Path) -> Result<Vec<u8>, ImageError> {
    if !cfg!(target_os = "macos") {
        return Err(ImageError::HeicUnsupported);
    }
    let out = std::env::temp_dir().join(format!("safeshot-{}.png", std::process::id()));
    let status = Command::new("sips")
        .args(["-s", "format", "png"])
        .arg(path)
        .arg("--out")
        .arg(&out)
        .output()?;
    let bytes = if status.status.success() {
        fs::read(&out).map_err(ImageError::from)
    } else {
        Err(ImageError::HeicFailed)
    };
    let _ = fs::remove_file(&out);
    bytes
}

pub fn read_image(path: &Path) -> Result<Vec<u8>, ImageError> {
    let ext = extension(path);
    if !READABLE.contains(&ext.as_str()) {
        return Err(ImageError::UnsupportedType);
    }
    if fs::metadata(path)?.len() > MAX_BYTES {
        return Err(ImageError::TooLarge);
    }
    if ext == "heic" || ext == "heif" {
        return convert_heic(path);
    }
    Ok(fs::read(path)?)
}

fn same_file(a: &Path, b: &Path) -> bool {
    let canon = |p: &Path| {
        let parent = p.parent()?.canonicalize().ok()?;
        Some(parent.join(p.file_name()?))
    };
    match (canon(a), canon(b)) {
        (Some(x), Some(y)) => x == y,
        _ => false,
    }
}

// Writes next to the target and renames, so a crash never leaves half an image behind.
pub fn write_image(target: &Path, original: Option<&Path>, bytes: &[u8]) -> Result<(), ImageError> {
    if !WRITABLE.contains(&extension(target).as_str()) {
        return Err(ImageError::UnsupportedType);
    }
    if original.is_some_and(|o| same_file(target, o)) {
        return Err(ImageError::WouldOverwriteOriginal);
    }
    let mut tmp = target.as_os_str().to_owned();
    tmp.push(".safeshot-tmp");
    let tmp = PathBuf::from(tmp);
    fs::write(&tmp, bytes)?;
    fs::rename(&tmp, target).inspect_err(|_| {
        let _ = fs::remove_file(&tmp);
    })?;
    Ok(())
}

#[tauri::command]
pub fn read_image_file(path: PathBuf) -> Result<Response, ImageError> {
    read_image(&path).map(Response::new)
}

fn header_path(request: &Request, name: &str) -> Option<PathBuf> {
    let value = request.headers().get(name)?.to_str().ok()?;
    let decoded = percent_decode_str(value).decode_utf8().ok()?;
    (!decoded.is_empty()).then(|| PathBuf::from(decoded.as_ref()))
}

// The image travels as the raw request body; the paths go in percent-encoded headers.
#[tauri::command]
pub fn save_image_file(request: Request) -> Result<(), ImageError> {
    let target = header_path(&request, "x-target").ok_or(ImageError::BadRequest)?;
    let original = header_path(&request, "x-original");
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(ImageError::BadRequest);
    };
    write_image(&target, original.as_deref(), bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("safeshot-test-{}-{name}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn writes_the_image_and_leaves_no_temp_file() {
        let dir = scratch("write");
        let target = dir.join("out.png");
        write_image(&target, None, b"png-bytes").unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"png-bytes");
        assert!(!dir.join("out.png.safeshot-tmp").exists());
    }

    #[test]
    fn refuses_to_overwrite_the_original() {
        let dir = scratch("same");
        let original = dir.join("print.png");
        fs::write(&original, b"original").unwrap();
        let err = write_image(&original, Some(&original), b"new").unwrap_err();
        assert!(matches!(err, ImageError::WouldOverwriteOriginal));
        assert_eq!(fs::read(&original).unwrap(), b"original");
    }

    #[test]
    fn detects_the_original_through_a_dotted_path() {
        let dir = scratch("dots");
        let original = dir.join("print.png");
        fs::write(&original, b"original").unwrap();
        let sneaky = dir.join(".").join("print.png");
        assert!(matches!(
            write_image(&sneaky, Some(&original), b"new"),
            Err(ImageError::WouldOverwriteOriginal)
        ));
    }

    #[test]
    fn rejects_unsupported_targets_and_sources() {
        let dir = scratch("types");
        assert!(matches!(
            write_image(&dir.join("x.txt"), None, b"x"),
            Err(ImageError::UnsupportedType)
        ));
        let text = dir.join("note.txt");
        fs::write(&text, b"x").unwrap();
        assert!(matches!(
            read_image(&text),
            Err(ImageError::UnsupportedType)
        ));
    }

    #[test]
    fn reads_supported_images_case_insensitively() {
        let dir = scratch("read");
        let file = dir.join("PRINT.PNG");
        fs::write(&file, b"data").unwrap();
        assert_eq!(read_image(&file).unwrap(), b"data");
    }
}
