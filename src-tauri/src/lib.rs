//! Desktop shell for the checklist PWA.
//!
//! The web app is unchanged — this wrapper adds the three things a browser
//! cannot do: an always-on-top window (the "floating note"), a global
//! shortcut to summon it from any app, and a tray icon so closing the
//! window hides it instead of quitting.

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_global_shortcut::ShortcutState;

/// Show the window if hidden, hide it if visible. Used by the tray icon and
/// the global shortcut alike.
fn toggle_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            // Ctrl+Alt+G summons the note from inside any application.
            // (Ctrl+Shift+Space was rejected: several Vietnamese/Japanese
            // IMEs already claim it.)
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(["ctrl+alt+g"])
                .expect("shortcut parses")
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_window(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Hiện / ẩn  (Ctrl+Alt+G)", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Thoát hẳn", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::with_id("tray")
                .icon(app.default_window_icon().expect("bundled icon").clone())
                .tooltip("Ghi chú — Ctrl+Alt+G")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => toggle_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing hides to the tray: a floating note that quit every time
            // you clicked X would defeat its purpose. Quit lives in the tray.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
