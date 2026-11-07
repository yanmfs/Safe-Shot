use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter};

#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuLabels {
    app: String,
    file: String,
    open: String,
    save: String,
    edit: String,
    undo: String,
    redo: String,
    cut: String,
    copy: String,
    paste: String,
    select_all: String,
    window: String,
}

/// Items the page has to react to; everything else in the menu is handled by the system.
const ACTIONS: [&str; 4] = ["open", "save", "undo", "redo"];

pub fn is_action(id: &str) -> bool {
    ACTIONS.contains(&id)
}

// Without its own menu the page may never see Cmd+Z or Cmd+S: the default menu takes the key first,
// and it has no Undo that knows about marks and bars. These items carry the keys to the page.
fn build(app: &AppHandle, l: &MenuLabels) -> tauri::Result<Menu<tauri::Wry>> {
    let separator = PredefinedMenuItem::separator(app)?;
    let app_menu = Submenu::with_items(
        app,
        &l.app,
        true,
        &[
            &PredefinedMenuItem::about(app, None, None)?,
            &separator,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &separator,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;
    let file = Submenu::with_items(
        app,
        &l.file,
        true,
        &[
            &MenuItem::with_id(app, "open", &l.open, true, Some("CmdOrCtrl+O"))?,
            &MenuItem::with_id(app, "save", &l.save, true, Some("CmdOrCtrl+S"))?,
            &separator,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        &l.edit,
        true,
        &[
            &MenuItem::with_id(app, "undo", &l.undo, true, Some("CmdOrCtrl+Z"))?,
            &MenuItem::with_id(app, "redo", &l.redo, true, Some("CmdOrCtrl+Shift+Z"))?,
            &separator,
            &PredefinedMenuItem::cut(app, Some(&l.cut))?,
            &PredefinedMenuItem::copy(app, Some(&l.copy))?,
            &PredefinedMenuItem::paste(app, Some(&l.paste))?,
            &PredefinedMenuItem::select_all(app, Some(&l.select_all))?,
        ],
    )?;
    let window = Submenu::with_items(
        app,
        &l.window,
        true,
        &[&PredefinedMenuItem::minimize(app, None)?],
    )?;
    Menu::with_items(app, &[&app_menu, &file, &edit, &window])
}

#[tauri::command]
pub fn set_menu_labels(app: AppHandle, labels: MenuLabels) -> Result<(), String> {
    // Windows has no menu bar in this app, so the keys stay with the page there.
    if cfg!(target_os = "macos") {
        let menu = build(&app, &labels).map_err(|e| e.to_string())?;
        app.set_menu(menu).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn on_event(app: &AppHandle, event: MenuEvent) {
    let id = event.id().as_ref();
    if is_action(id) {
        let _ = app.emit("menu-action", id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_items_the_page_handles_are_forwarded() {
        for id in ["open", "save", "undo", "redo"] {
            assert!(is_action(id));
        }
        assert!(!is_action("copy"));
        assert!(!is_action(""));
    }
}
