import { Header } from './components/Header/Header'

function App(): React.JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  return (
    <>
      <Header />
        <div className="action">
          <a target="_blank" rel="noreferrer" onClick={ipcHandle}>
            Send IPC
          </a>
        </div>
      <p className='bg-red-500 dark:bg-slate-900, dark:text-white text-bold'>
        Hola
      </p>
    </>
  )
}

export default App
