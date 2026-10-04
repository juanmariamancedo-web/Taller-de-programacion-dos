import { Header } from './components/Header/Header'
import HomePanel from './components/views/HomePanel'
import ProductsPanel from './components/views/ProductsPanel'
import { NavItem } from '../../main/domain/types/NavItem'
import OrdersPanel from './components/views/OrdersPanel'
import ClientsPanel from './components/views/ClientsPanel'
import CreateClientPage from './components/views/CreateClientPage'
import { useAppSelector } from "./store/hooks";
import LoginPanel from './components/views/LoginPanel'
import Users from './components/views/Users'
import CreateUserPage from './components/views/CreateUserPage'
import CreateOrderPage from "./components/views/CreateOrderPage"
import Profile from './components/views/Profile'

function App(): React.JSX.Element {
  const currentTab = useAppSelector((state) => state.app.currentTab)
  const session = useAppSelector((state) => state.app.session)
  const roleId = useAppSelector((state) => state.app.session?.roleId)
  const roleName = useAppSelector((state) => state.app.session?.roleName?.toLowerCase())
  const orderToEdit = useAppSelector((state)=> state.app.orderToEdit)

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Inicio'},
    { id: 'clients', label: 'Clientes'},
    // { id: 'settings', label: 'Ajustes'},
    { id: 'products', label: 'Productos'},
    { id: 'orders', label: 'Ordenes'} 
  ]

  if(roleId == 1 || roleName === 'admin'){
    navItems.push({ id: 'users', label: 'Usuarios'})
  }

  const renderPanel = () => {
    switch(currentTab){
      case "dashboard":
        return <HomePanel />
      case "products":
        return <ProductsPanel />
      case "orders":
        return <OrdersPanel key={Date.now()} />
      case "users":
        if(roleId == 1 || roleName === 'admin'){
          return <Users />
        }
        return <HomePanel />
      case "clients":
        return <ClientsPanel />
      case "clients-create": 
        if(roleId == 1 || roleId == 3 || roleName === 'admin' || roleName === 'vendedor'){
          return <CreateClientPage />
        }
        return <ClientsPanel />
      case "users-create":
        if(roleId == 1 || roleName === 'admin'){
          return <CreateUserPage />
        }
        return <Users />
      case "order-create":
        // Permitir el acceso a los 4 roles (Admin: 1, Operador: 2, Vendedor: 3, Supervisor: 4)
        if(
          roleId == 1 || roleId == 2 || roleId == 3 || roleId == 4 ||
          ['admin', 'operador', 'vendedor', 'supervisor'].includes(roleName || '')
        ){
          return <CreateOrderPage initialOrder={orderToEdit} />
        }
        return <OrdersPanel />
      case "profile":
        return <Profile />
      default:
        return <HomePanel />
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-between">
      {/* Fondo arreglado con fixed para cubrir toda la pantalla en todo momento */}
      <div
        className="fixed inset-0 z-[-1] bg-neutral-100 dark:bg-neutral-950
        bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(217,216,255,0.5),rgba(255,255,255,0.9))]
        dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"
      ></div>

      {session && <Header navItems={navItems} />}

      {/* Margen pt-20/pt-24 para despegar el título y contenido del Header */}
      <main className={`container mx-auto ${session ? 'pt-24' : 'pt-0'} pb-10 px-4 flex-1 flex flex-col`}>
        <LoginPanel>
          {renderPanel()}
        </LoginPanel>
      </main>
    </div>
  )
}

export default App