use serde::Serialize;
use tauri::ipc::{InvokeBody, Request};

#[derive(Debug, thiserror::Error)]
pub enum OcrError {
    #[cfg_attr(any(target_os = "macos", windows), allow(dead_code))]
    #[error("no native text reader on this system")]
    Unsupported,
    #[error("the image could not be read")]
    BadImage,
    #[error("native text reading failed: {0}")]
    Failed(String),
}

impl Serialize for OcrError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

/// Same shape as the page the Tesseract engine produces, in pixels of the original image.
#[derive(Debug, Serialize, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Word {
    pub text: String,
    #[serde(rename = "box")]
    pub area: Rect,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Line {
    pub words: Vec<Word>,
    #[serde(rename = "box")]
    pub area: Rect,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Page {
    pub width: u32,
    pub height: u32,
    pub lines: Vec<Line>,
}

/// Width and height from the PNG header, so the caller does not have to send them separately.
pub fn png_size(bytes: &[u8]) -> Option<(u32, u32)> {
    const SIGNATURE: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a];
    if bytes.len() < 24 || bytes[..8] != SIGNATURE || &bytes[12..16] != b"IHDR" {
        return None;
    }
    let read =
        |at: usize| u32::from_be_bytes([bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]]);
    Some((read(16), read(20)))
}

/// Splits a line into words as (start, length) in UTF-16 units, which is what Vision ranges use.
#[cfg(any(target_os = "macos", test))]
pub fn word_ranges(text: &str) -> Vec<(usize, usize)> {
    let mut ranges = Vec::new();
    let mut start: Option<usize> = None;
    let mut at = 0usize;
    for ch in text.chars() {
        if ch.is_whitespace() {
            if let Some(s) = start.take() {
                ranges.push((s, at - s));
            }
        } else if start.is_none() {
            start = Some(at);
        }
        at += ch.len_utf16();
    }
    if let Some(s) = start {
        ranges.push((s, at - s));
    }
    ranges
}

#[cfg(target_os = "macos")]
mod mac {
    use super::{png_size, word_ranges, Line, OcrError, Page, Rect, Word};
    use objc2::rc::Retained;
    use objc2::{msg_send, AnyThread};
    use objc2_foundation::{NSArray, NSData, NSDictionary, NSError, NSRange, NSString};
    use objc2_vision::{
        VNImageRequestHandler, VNRecognizeTextRequest, VNRecognizedText, VNRectangleObservation,
        VNRequest, VNRequestTextRecognitionLevel,
    };

    // Vision measures from the bottom left corner, in fractions of the image.
    fn to_pixels(x: f64, y: f64, w: f64, h: f64, width: f64, height: f64) -> Rect {
        Rect {
            x: x * width,
            y: (1.0 - y - h) * height,
            w: w * width,
            h: h * height,
        }
    }

    fn word_box(
        candidate: &VNRecognizedText,
        range: (usize, usize),
        line: &Rect,
        total: usize,
        width: f64,
        height: f64,
    ) -> Rect {
        let ns_range = NSRange::new(range.0, range.1);
        let found: Result<Retained<VNRectangleObservation>, Retained<NSError>> =
            unsafe { msg_send![candidate, boundingBoxForRange: ns_range, error: _] };
        match found {
            Ok(observation) => {
                let b = unsafe { observation.boundingBox() };
                to_pixels(
                    b.origin.x,
                    b.origin.y,
                    b.size.width,
                    b.size.height,
                    width,
                    height,
                )
            }
            // Without a box for the range, share the line's width in proportion to the characters.
            Err(_) => {
                let share = line.w / total.max(1) as f64;
                Rect {
                    x: line.x + share * range.0 as f64,
                    y: line.y,
                    w: share * range.1 as f64,
                    h: line.h,
                }
            }
        }
    }

    pub fn recognize(png: &[u8]) -> Result<Page, OcrError> {
        let (width, height) = png_size(png).ok_or(OcrError::BadImage)?;
        let (w, h) = (f64::from(width), f64::from(height));
        let data = NSData::with_bytes(png);
        let options = NSDictionary::new();
        let handler = VNImageRequestHandler::initWithData_options(
            VNImageRequestHandler::alloc(),
            &data,
            &options,
        );

        let request = VNRecognizeTextRequest::new();
        request.setRecognitionLevel(VNRequestTextRecognitionLevel::Accurate);
        // Language correction "fixes" digits and codes into words; the raw reading is what is wanted.
        request.setUsesLanguageCorrection(false);
        let languages = NSArray::from_retained_slice(&[
            NSString::from_str("pt-BR"),
            NSString::from_str("en-US"),
        ]);
        request.setRecognitionLanguages(&languages);

        let requests: Retained<NSArray<VNRequest>> =
            NSArray::from_retained_slice(&[Retained::into_super(Retained::into_super(
                request.clone(),
            ))]);
        handler
            .performRequests_error(&requests)
            .map_err(|e| OcrError::Failed(e.localizedDescription().to_string()))?;

        let mut lines = Vec::new();
        for observation in request.results().iter().flat_map(|r| r.iter()) {
            let Some(candidate) = observation.topCandidates(1).iter().next() else {
                continue;
            };
            let text = candidate.string().to_string();
            let b = unsafe { observation.boundingBox() };
            let area = to_pixels(b.origin.x, b.origin.y, b.size.width, b.size.height, w, h);
            let total = text.encode_utf16().count();
            let words: Vec<Word> = word_ranges(&text)
                .into_iter()
                .map(|range| {
                    let slice = String::from_utf16_lossy(
                        &text
                            .encode_utf16()
                            .skip(range.0)
                            .take(range.1)
                            .collect::<Vec<_>>(),
                    );
                    Word {
                        text: slice,
                        area: word_box(&candidate, range, &area, total, w, h),
                    }
                })
                .collect();
            if !words.is_empty() {
                lines.push(Line { words, area });
            }
        }
        Ok(Page {
            width,
            height,
            lines,
        })
    }
}

#[cfg(target_os = "macos")]
pub fn recognize(png: &[u8]) -> Result<Page, OcrError> {
    mac::recognize(png)
}

#[cfg(windows)]
mod win {
    use super::{png_size, Line, OcrError, Page, Rect, Word};
    use windows::core::HSTRING;
    use windows::Globalization::Language;
    use windows::Graphics::Imaging::BitmapDecoder;
    use windows::Media::Ocr::OcrEngine;
    use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};

    fn failed(e: windows::core::Error) -> OcrError {
        OcrError::Failed(e.message())
    }

    // Windows can only read in the languages that are installed; take the first of ours that is.
    fn engine() -> Result<OcrEngine, OcrError> {
        for tag in ["pt-BR", "pt", "en-US", "en"] {
            let Ok(language) = Language::CreateLanguage(&HSTRING::from(tag)) else {
                continue;
            };
            if OcrEngine::IsLanguageSupported(&language).unwrap_or(false) {
                if let Ok(engine) = OcrEngine::TryCreateFromLanguage(&language) {
                    return Ok(engine);
                }
            }
        }
        OcrEngine::TryCreateFromUserProfileLanguages().map_err(|_| OcrError::Unsupported)
    }

    // Runs on a blocking thread, so waiting on the async calls is fine.
    pub fn recognize(png: &[u8]) -> Result<Page, OcrError> {
        let (width, height) = png_size(png).ok_or(OcrError::BadImage)?;
        let stream = InMemoryRandomAccessStream::new().map_err(failed)?;
        let writer = DataWriter::CreateDataWriter(&stream).map_err(failed)?;
        writer.WriteBytes(png).map_err(failed)?;
        writer.StoreAsync().map_err(failed)?.get().map_err(failed)?;
        writer.DetachStream().map_err(failed)?;
        stream.Seek(0).map_err(failed)?;

        let decoder = BitmapDecoder::CreateAsync(&stream)
            .map_err(failed)?
            .get()
            .map_err(|_| OcrError::BadImage)?;
        let bitmap = decoder
            .GetSoftwareBitmapAsync()
            .map_err(failed)?
            .get()
            .map_err(failed)?;
        let result = engine()?
            .RecognizeAsync(&bitmap)
            .map_err(failed)?
            .get()
            .map_err(failed)?;

        let mut lines = Vec::new();
        for line in result.Lines().map_err(failed)? {
            let mut words = Vec::new();
            for word in line.Words().map_err(failed)? {
                let r = word.BoundingRect().map_err(failed)?;
                words.push(Word {
                    text: word.Text().map_err(failed)?.to_string(),
                    area: Rect {
                        x: f64::from(r.X),
                        y: f64::from(r.Y),
                        w: f64::from(r.Width),
                        h: f64::from(r.Height),
                    },
                });
            }
            if words.is_empty() {
                continue;
            }
            // A line has no box of its own here: it is the union of its words.
            let left = words.iter().map(|w| w.area.x).fold(f64::MAX, f64::min);
            let top = words.iter().map(|w| w.area.y).fold(f64::MAX, f64::min);
            let right = words
                .iter()
                .map(|w| w.area.x + w.area.w)
                .fold(f64::MIN, f64::max);
            let bottom = words
                .iter()
                .map(|w| w.area.y + w.area.h)
                .fold(f64::MIN, f64::max);
            lines.push(Line {
                words,
                area: Rect {
                    x: left,
                    y: top,
                    w: right - left,
                    h: bottom - top,
                },
            });
        }
        Ok(Page {
            width,
            height,
            lines,
        })
    }
}

#[cfg(windows)]
pub fn recognize(png: &[u8]) -> Result<Page, OcrError> {
    win::recognize(png)
}

#[cfg(not(any(target_os = "macos", windows)))]
pub fn recognize(_png: &[u8]) -> Result<Page, OcrError> {
    Err(OcrError::Unsupported)
}

// The image travels as the raw request body (a PNG), not as JSON, to avoid copying megabytes of numbers.
#[tauri::command]
pub async fn native_ocr(request: Request<'_>) -> Result<Page, OcrError> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(OcrError::BadImage);
    };
    let png = bytes.clone();
    tauri::async_runtime::spawn_blocking(move || recognize(&png))
        .await
        .map_err(|e| OcrError::Failed(e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_words_in_utf16_units() {
        assert_eq!(word_ranges("CPF 556.585.056-82"), vec![(0, 3), (4, 14)]);
        // "é" is one unit, the emoji takes two.
        assert_eq!(word_ranges("é 😀 ok"), vec![(0, 1), (2, 2), (5, 2)]);
        assert!(word_ranges("   ").is_empty());
    }

    #[test]
    fn reads_the_png_header() {
        let mut png = vec![0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
        png.extend_from_slice(b"IHDR");
        png.extend_from_slice(&640u32.to_be_bytes());
        png.extend_from_slice(&360u32.to_be_bytes());
        assert_eq!(png_size(&png), Some((640, 360)));
        assert_eq!(png_size(b"not a png"), None);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn reads_a_generated_screen_with_vision() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../tests/fixtures/shots/chat-light.png");
        let png = std::fs::read(path).unwrap();
        let (width, height) = png_size(&png).unwrap();
        let page = recognize(&png).unwrap();
        assert_eq!((page.width, page.height), (width, height));

        let words: Vec<&Word> = page.lines.iter().flat_map(|l| l.words.iter()).collect();
        let joined: String = words
            .iter()
            .map(|w| w.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");
        assert!(joined.contains("556.585.056-82"), "CPF not read: {joined}");
        assert!(
            joined.contains("carla.souza@exemplo.com.br"),
            "e-mail not read: {joined}"
        );
        for word in &words {
            let a = &word.area;
            assert!(a.x >= -2.0 && a.y >= -2.0 && a.x + a.w <= f64::from(width) + 2.0);
            assert!(a.y + a.h <= f64::from(height) + 2.0 && a.w > 0.0 && a.h > 0.0);
        }
    }

    // Writes the page for each generated screen to the folder in OCR_PAGES_OUT, for the recall test.
    #[cfg(target_os = "macos")]
    #[test]
    #[ignore = "writes files; run on demand"]
    fn dump_pages_for_recall() {
        let out = std::path::PathBuf::from(std::env::var("OCR_PAGES_OUT").expect("OCR_PAGES_OUT"));
        std::fs::create_dir_all(&out).unwrap();
        let shots =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../tests/fixtures/shots");
        for entry in std::fs::read_dir(shots).unwrap() {
            let path = entry.unwrap().path();
            if path.extension().is_some_and(|e| e == "png") {
                let page = recognize(&std::fs::read(&path).unwrap()).unwrap();
                let name = path.file_stem().unwrap().to_string_lossy().into_owned();
                std::fs::write(
                    out.join(format!("{name}.json")),
                    serde_json::to_vec(&page).unwrap(),
                )
                .unwrap();
            }
        }
    }
}
