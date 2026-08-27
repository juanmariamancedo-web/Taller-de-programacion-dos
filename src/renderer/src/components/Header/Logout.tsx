import LogoutIcon from "../icons/LoginIcon";


export default function LoginOut(){
    async function onClick(){
        await window.electronAPI?.logout()
        window.location.reload();
    };

    return(
        <>
            <button onClick={onClick} className="hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition flex justify-center items-center cursor-pointer">
                <LogoutIcon />
            </button>       
        </>
    )
}