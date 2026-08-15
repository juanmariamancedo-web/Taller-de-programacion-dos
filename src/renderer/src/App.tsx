import { Header } from './components/Header/Header'
import { useState } from 'react'
import HomePanel from './components/views/HomePanel'
import ProductsPanel from './components/views/ProductsPanel'

//Paneles posibles
export type Tab = 'dashboard' | 'clients' | 'settings' | "products"

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
    { id: 'products', label: 'Productos'}
  ]

  //Asocciacion de id de paneles con Views
  const renderPanel = () => {
    switch(currentTab){
      case "dashboard":
        return <HomePanel />
      case"products":
        return <ProductsPanel />
      default:
        return null
    }
  }

  const [currentTab, setCurrentTab] = useState<Tab>("dashboard")


  return (
    <>
      <Header onSelectTab={setCurrentTab} currentTab={currentTab} navItems={navItems} />
      {renderPanel()}
    </>
  )
}

export default App
