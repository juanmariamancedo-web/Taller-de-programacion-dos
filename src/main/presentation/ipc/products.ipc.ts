import { ipcMain } from 'electron';
import {
    ProductInput,
    ProductStockInput,
    ProductStatusInput,
    SearchParams,
    UpdateProductInput
} from '../../domain/types/electron-env';
import { productsService } from '../../services/products.service';
import { clodinaryService } from '../../services/cloudinary.services';


export function registerProductsIPC(): void {


    ipcMain.handle('products:upload-image', async (_event, dataUrl: string) => {
        try {
            return { success: true, data: { url: await clodinaryService.uploadImage(dataUrl) } };
} catch (error) {
    return {
    success: false,
    message: error instanceof Error ? error.message : 'No se pudo subir la imagen.' 
        };
        }
    });
    
    ipcMain.handle('products:get-categories', async () => {
        try {
            return { success: true, data: await productsService.getProductCategories() };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'No se pudieron cargar las categorías.'
            };
        }

    });

    ipcMain.handle('products:create', async (_event, input: ProductInput) => {
        try {
            return { success: true, data: await productsService.createProduct(input) };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'No se pudo crear el producto.'
            };
        }
    });

    ipcMain.handle('products:update', async (_event, input: UpdateProductInput) => {
        try {
            return { success: true, data: await productsService.updateProduct(input) };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'No se pudo actualizar el producto.'
            };
        }
    });

    ipcMain.handle('products:set-status', async (_event, input: ProductStatusInput) => {
        try {
            return { success: true, data: await productsService.setProductStatus(input.id, input.isActive) };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'No se pudo cambiar el estado del producto.'
            };
        }
    });

    ipcMain.handle('products:update-stock', async (_event, input: ProductStockInput) => {
        try {
            return { success: true, data: await productsService.updateProductStock(input.id, input.stock) };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'No se pudo actualizar el stock.'
            };
        }
    });

    // ─── NUEVO HANDLER PARA RESERVAR STOCK ───
    ipcMain.handle('products:reserve', async (_event, productId: string, quantity: number, previousQuantity: number) => {
        try {
            return await productsService.reserveProductStock(productId, quantity, previousQuantity);
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'No se pudo reservar el stock.'
            };
        }
    });

    ipcMain.handle('products:getProducts', async (_event, searchParams: SearchParams) => {
        try {
            const rawData = await productsService.getProducts(searchParams);
            
            // Convierte Decimal, BigInt y Date a tipos primitivos JSON planos (string/number)
            const data = JSON.parse(
            JSON.stringify(rawData, (_key, value) =>
                typeof value === 'bigint' ? value.toString() : value
            )
            );

            return data;
        } catch (error) {
            console.error('Failed to fetch products:', error);
            return { 
                success: false, 
                message: error instanceof Error ? error.message : 'Unknown error occurred' 
            };
        }
    });
}