export class CloudinaryService{
    async uploadImage(dataUrl: string): Promise<string> {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME
        const preset = process.env.CLOUDINARY_UPLOAD_PRESET
        if (!cloudName || !preset) throw new Error('Cloudinary no esta configurado')

        if(!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(dataUrl)){
            throw new Error('El archivo no es una imagen valida')
        }

        const form = new FormData()
        form.append('file', dataUrl)
        form.append('upload_preset', preset)
        form.append('folder', 'productos')

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,{
            method: 'POST',
            body: form
        })
        const json = await res.json()
        if(!res.ok) throw new Error(json?.error?.message ?? 'No se pudo subir la imagen')
        if (typeof json?.secure_url !== 'string') throw new Error('Cloudinary no devolvió la URL de la imagen.')

        return json.secure_url
}

}

export const clodinaryService = new CloudinaryService()