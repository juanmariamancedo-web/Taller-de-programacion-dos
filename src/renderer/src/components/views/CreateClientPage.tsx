import { setCurrentTab } from '../../store/slices/appSlice'
import { useAppDispatch } from '../../store/hooks'

export default function CreateClientPage(): React.JSX.Element {
	const dispatch = useAppDispatch()

	return (
		<div className="flex flex-col items-center gap-4">
			<h1 className="text-gray-900 dark:text-white text-3xl font-bold">Nuevo cliente</h1>
			<button
				type="button"
				onClick={() => dispatch(setCurrentTab('clients'))}
				className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
			>
				Volver a clientes
			</button>
		</div>
	)
}
