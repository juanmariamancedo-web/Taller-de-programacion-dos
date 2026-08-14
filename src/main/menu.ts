import { app, Menu } from "electron";

export function setMainManu(){
    const template = [
        {
            label: app.getName(),
            submenu: [
                {
                    label: "Salir", 
                    click: () => {
                        app.quit()
                    }
                }
            ]
        }
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
}