import { Header } from './components/Header/Header'
import { useState } from 'react'
import HomePanel from './components/views/HomePanel'
import ProductsPanel from './components/views/ProductsPanel'

//Paneles posibles
export type Tab = 'dashboard' | 'clients' | 'settings' | "products" | "orders"

export type NavItem = {
  id: Tab, 
  label: string
}

function App(): React.JSX.Element {
  //Asociacion de id de paneles con labels
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Inicio'},
    { id: 'clients', label: 'Clientes'},
    { id: 'settings', label: 'Ajustes'},
    { id: 'products', label: 'Productos'},
    {id: "orders", label: "Ordenes"}
  ]

  //Asocciacion de id de paneles con Views
  const renderPanel = () => {
    switch(currentTab){
      case "dashboard":
        return <HomePanel totalClients={3} totalPedidosPendientes={3} totalPedidosEntregados={3} averageTicket={3} onSelectTab={setCurrentTab} />
      case"products":
        return <ProductsPanel />
      default:
        return null
    }
  }

  const [currentTab, setCurrentTab] = useState<Tab>("dashboard")


  return (
    <div className="min-h-screen flex flex-col justify-between gap-10">
      <div
          className="absolute top-0 bottom-0 z-[-2] min-h-screen w-full bg-neutral-100 dark:bg-neutral-950
          bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(217,216,255,0.5),rgba(255,255,255,0.9))]
          dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"
      ></div>
      <Header onSelectTab={setCurrentTab} currentTab={currentTab} navItems={navItems} />
      <main className="container mx-auto pt-14 px-4">
        {renderPanel()}
      </main>
    </div>
  )
}

export default App
