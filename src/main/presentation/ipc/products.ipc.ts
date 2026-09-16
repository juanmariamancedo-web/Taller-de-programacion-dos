import { ipcMain } from 'electron';
import { SearchParams } from '../../domain/types/electron-env';
import { productsService } from '../../services/products.service';

export function registerProductsIPC(): void {
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
            console.error('Failed to fetch orders:', error);
            return { 
                success: false, 
                message: error instanceof Error ? error.message : 'Unknown error occurred' 
            };
        }
    });
}