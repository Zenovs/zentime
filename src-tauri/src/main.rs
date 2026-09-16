// Verhindert unter Windows ein zusätzliches Konsolenfenster; auf Linux und macOS wirkungslos.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    zentime_lib::run()
}
