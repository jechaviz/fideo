
import { ProductGroup, Warehouse, Employee, Price, CrateType, InventoryBatch, Customer, Supplier, PurchaseOrder, CrateInventory, Message, InterpretationType, FixedAsset, Expense, RipeningRule, Quality, MessageTemplate } from '../types';

export const INITIAL_PRODUCT_GROUPS: ProductGroup[] = [
  { 
    id: 'pg1', name: 'Manzana', icon: '🍎', category: 'Manzanas', unit: 'cajas', archived: false,
    varieties: [
        { id: 'v1', name: 'Golden', icon: '🍏', sizes: ['Primera', 'Segunda', 'Tercera', 'Contra', 'Canica'], aliases: ['Golden', 'amarilla', 'supreme'], archived: false },
        { id: 'v2', name: 'Red', icon: '🍎', sizes: ['Primera', 'Segunda'], aliases: ['Red', 'roja'], archived: false },
    ]
  },
  { 
    id: 'pg2', name: 'Aguacate', icon: '🥑', category: 'Aguacates', unit: 'cajas', archived: false,
    varieties: [
        { id: 'v3', name: 'Hass', icon: '🥑', sizes: ['Extra', 'Primera', 'Segunda', 'Canica'], aliases: ['Hass', 'aguacate'], archived: false },
    ]
  },
  { 
    id: 'pg3', name: 'Mango', icon: '🥭', category: 'Mangos', unit: 'cajas', archived: false,
    varieties: [
        { id: 'v4', name: 'Tommy', icon: '🥭', sizes: ['Primera', 'Segunda'], aliases: ['Tommy'], archived: false },
    ]
  },
  { 
    id: 'pg4', name: 'Uva', icon: '🍇', category: 'Uvas', unit: 'cajas', archived: false,
    varieties: [
        { id: 'v5', name: 'Sin Semilla', icon: '🍇', sizes: ['Sin semilla'], aliases: ['uva verde', 'verde'], archived: false },
    ]
   },
];

export const INITIAL_WAREHOUSES: Warehouse[] = [
    { id: 'w1', name: 'San Pedro 113, Plazas del Sol 2da Seccion, Querétaro, Qro. 76099', icon: 'SP113', archived: false },
    { id: 'w2', name: 'Calle 4 Poniente 205, Central de Abastos', icon: 'C4P205', archived: false },
];

export const INITIAL_EMPLOYEES: Employee[] = [
    { id: 'e1', name: 'Empleado Pepe', role: 'Admin' },
    { id: 'e2', name: 'Empleado Luis', role: 'Repartidor' },
    { id: 'e3', name: 'Empleado Carlos', role: 'Empacador' }
];

export const INITIAL_PRICES: Price[] = [
    { varietyId: 'v3', size: 'Canica', quality: 'Normal', state: 'Maduro', price: 380 },
    { varietyId: 'v3', size: 'Canica', quality: 'Normal', state: 'Entrado', price: 350 },
    { varietyId: 'v3', size: 'Canica', quality: 'Normal', state: 'Verde', price: 320 },
    { varietyId: 'v3', size: 'Segunda', quality: 'Normal', state: 'Maduro', price: 550 },
    { varietyId: 'v3', size: 'Primera', quality: 'Normal', state: 'Maduro', price: 780 },
    { varietyId: 'v3', size: 'Extra', quality: 'Normal', state: 'Maduro', price: 850 },
    { varietyId: 'v1', size: 'Primera', quality: 'Normal', state: 'Maduro', price: 650 },
    { varietyId: 'v2', size: 'Primera', quality: 'Normal', state: 'Maduro', price: 680 },
    { varietyId: 'v5', size: 'Sin semilla', quality: 'Normal', state: 'Maduro', price: 750 },
];

export const INITIAL_CRATE_TYPES: CrateType[] = [
    { id: 'ct_andrea', name: 'Caja Andrea (Grande)', shortCode: 'CA', color: 'Verde', size: 'Grande', cost: 60, capacity: 30, dimensions: { width: 52.2, depth: 34, height: 30.3 } },
    { id: 'ct_recol', name: 'Caja Recolección (Mediana)', shortCode: 'CR', color: 'Negra', size: 'Mediana', cost: 50, capacity: 25, dimensions: { width: 48, depth: 33, height: 26 } },
    { id: 'ct_hass', name: 'Caja Aguacate Hass (10kg)', shortCode: 'CH', color: 'Roja', size: 'Chica', cost: 45, capacity: 10, dimensions: { width: 49.5, depth: 30, height: 17.8 } },
    { id: 'ct_madera', name: 'Moreliana (Madera)', shortCode: 'M', color: 'Madera', size: 'Mediana', cost: 40, capacity: 12, dimensions: { width: 50, depth: 35, height: 30 } }, 
];

export const INITIAL_INVENTORY: InventoryBatch[] = [
    { id: 'b1', varietyId: 'v1', size: 'Primera', quality: 'Normal', quantity: 50, state: 'Verde', location: 'Cámara Fría', warehouseId: 'w1', packagingId: 'ct_andrea', entryDate: new Date('2024-05-20') },
    { id: 'b2', varietyId: 'v1', size: 'Primera', quality: 'Normal', quantity: 30, state: 'Entrado', location: 'Maduración', warehouseId: 'w1', packagingId: 'ct_andrea', entryDate: new Date('2024-05-28') },
    { id: 'b3', varietyId: 'v1', size: 'Primera', quality: 'Normal', quantity: 70, state: 'Maduro', location: 'Piso de Venta', warehouseId: 'w1', packagingId: 'ct_madera', entryDate: new Date('2024-05-30') },
    { id: 'b4', varietyId: 'v2', size: 'Primera', quality: 'Normal', quantity: 120, state: 'Maduro', location: 'Piso de Venta', warehouseId: 'w1', packagingId: 'ct_recol', entryDate: new Date('2024-05-29') },
    { id: 'b5', varietyId: 'v3', size: 'Extra', quality: 'Normal', quantity: 80, state: 'Verde', location: 'Cámara Fría', warehouseId: 'w1', packagingId: 'ct_hass', entryDate: new Date('2024-05-25') },
    { id: 'b6', varietyId: 'v3', size: 'Extra', quality: 'Normal', quantity: 50, state: 'Maduro', location: 'Piso de Venta', warehouseId: 'w1', packagingId: 'ct_hass', entryDate: new Date('2024-05-30') },
    { id: 'b12', varietyId: 'v3', size: 'Extra', quality: 'Normal', quantity: 50, state: 'Maduro', location: 'Piso de Venta', warehouseId: 'w2', packagingId: 'ct_hass', entryDate: new Date('2024-05-30') },
    { id: 'b7', varietyId: 'v4', size: 'Primera', quality: 'Normal', quantity: 80, state: 'Entrado', location: 'Maduración', warehouseId: 'w1', packagingId: 'ct_recol', entryDate: new Date('2024-05-30') },
    { id: 'b8', varietyId: 'v5', size: 'Sin semilla', quality: 'Normal', quantity: 50, state: 'Maduro', location: 'Piso de Venta', warehouseId: 'w1', packagingId: 'ct_recol', entryDate: new Date('2024-05-31') },
    { id: 'b9', varietyId: 'v3', size: 'Canica', quality: 'Merma', quantity: 5, state: 'Maduro', location: 'Piso de Venta', warehouseId: 'w1', packagingId: 'ct_hass', entryDate: new Date('2024-05-31') },
    { id: 'b10', varietyId: 'v3', size: 'Canica', quality: 'Normal', quantity: 20, state: 'Verde', location: 'Cámara Fría', warehouseId: 'w1', packagingId: 'ct_hass', entryDate: new Date('2024-05-31') },
    { id: 'b11', varietyId: 'v3', size: 'Segunda', quality: 'Normal', quantity: 15, state: 'Verde', location: 'Cámara Fría', warehouseId: 'w1', packagingId: 'ct_hass', entryDate: new Date('2024-06-01') },
];

export const INITIAL_CUSTOMERS: Customer[] = [
    { 
        id: 'c1', name: 'Cliente Juan', 
        contacts: [{name: 'Juan', isPrimary: true}, {name: 'Pedrito', isPrimary: false}, {name: 'Lulu (esposa)', isPrimary: false}, {name: 'El Chiles (ayudante)', isPrimary: false}], 
        specialPrices: [{ varietyId: 'v1', size: 'Primera', quality: 'Normal', state: 'Maduro', price: 640 }],
        schedule: { days: ['Lunes', 'Miércoles', 'Viernes'], time: '05:00 - 07:00' },
        deliveryNotes: 'Camioneta Ford Ranger blanca, estacionada al final de la Rampa C.',
        creditStatus: 'Confiable',
        creditLimit: 15000,
    },
    { 
        id: 'c2', name: 'Cliente Ana', 
        contacts: [{name: 'Ana', isPrimary: true}], 
        specialPrices: [],
        schedule: { days: ['Martes', 'Jueves'], time: '06:00 - 08:00' },
        deliveryNotes: 'Entregar en el puesto #23, Nave K. Preguntar por Ana o su hijo.',
        creditStatus: 'En Observación',
        creditLimit: 0,
    },
    { 
        id: 'c3', name: 'Cliente Pedro', 
        contacts: [{name: 'Pedro', isPrimary: true}], 
        specialPrices: [{ varietyId: 'v3', size: 'Extra', quality: 'Normal', state: 'Maduro', price: 820 }],
        schedule: { days: ['Sábado'], time: '04:00 - 06:00' },
        deliveryNotes: 'Camión Tsuru rojo, cerca de la báscula principal.',
        creditStatus: 'Contado Solamente',
        creditLimit: 0,
    },
    { 
        id: 'c4', name: 'Dani boy', 
        contacts: [{name: 'Dani boy', isPrimary: true}], 
        specialPrices: [],
        schedule: { days: ['Lunes', 'Jueves'], time: '08:00 - 10:00' },
        deliveryNotes: 'Puesto de jugos en la entrada de la Nave A.',
        creditStatus: 'Confiable',
        creditLimit: 5000,
    }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
    {
        id: 'sup1',
        name: 'El Güero de Michoacán',
        contact: '55-1234-5678',
        supplies: [
            {
                varietyId: 'v3', // Aguacate Hass
                baseCost: 280,
                freightCost: 20,
                availableSizes: ['Extra', 'Primera', 'Segunda'],
                packagingOptions: [
                    { name: 'Caja 10kg', cost: 15 },
                    { name: 'Caja 25kg', cost: 25 },
                ],
                notes: 'Fruta de campo, madura rápido.'
            }
        ]
    },
    {
        id: 'sup2',
        name: 'Manzanas del Norte',
        contact: '81-8765-4321',
        supplies: [
            {
                varietyId: 'v1', // Manzana Golden
                baseCost: 400,
                freightCost: 30,
                availableSizes: ['Primera', 'Segunda'],
                packagingOptions: [ { name: 'Caja 20kg', cost: 30 } ],
            },
            {
                varietyId: 'v2', // Manzana Red
                baseCost: 420,
                freightCost: 30,
                availableSizes: ['Primera'],
                packagingOptions: [ { name: 'Caja 20kg', cost: 30 } ],
            }
        ]
    }
];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
    {
        id: 'po_demo_1',
        supplierId: 'sup1', // El Güero de Michoacán
        varietyId: 'v3', // Aguacate Hass
        size: 'Primera',
        packaging: 'Caja 10kg',
        quantity: 100,
        totalCost: 31500, // (280 base + 20 flete + 15 caja) * 100
        status: 'Recibido',
        orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        expectedArrivalDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        paymentMethod: 'Crédito',
    },
    {
        id: 'po_demo_2',
        supplierId: 'sup2', // Manzanas del Norte
        varietyId: 'v1', // Manzana Golden
        size: 'Primera',
        packaging: 'Caja 20kg',
        quantity: 80,
        totalCost: 36800, // (400 base + 30 flete + 30 caja) * 80
        status: 'Ordenado',
        orderDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        expectedArrivalDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // tomorrow
        paymentMethod: 'Crédito',
    },
    {
        id: 'po_demo_3',
        supplierId: 'sup1',
        varietyId: 'v3',
        size: 'Segunda',
        packaging: 'Caja 25kg',
        quantity: 150,
        totalCost: 48750, // (280 base + 20 flete + 25 caja) * 150
        status: 'Pendiente',
        orderDate: new Date(),
        paymentMethod: 'Crédito',
    },
];


export const INITIAL_CRATE_INVENTORY: CrateInventory[] = [
    { crateTypeId: 'ct_andrea', quantityOwned: 150 },
    { crateTypeId: 'ct_hass', quantityOwned: 200 },
    { crateTypeId: 'ct_recol', quantityOwned: 100 },
];

export const INITIAL_INTERPRETED_MESSAGES: Message[] = [
    { id: `msg_approved_1`, sender: 'Cliente Juan', text: 'dame 5 de supreme para la rampa en la C', timestamp: new Date(), status: 'approved', interpretation: { type: InterpretationType.VENTA, certainty: 0.95, explanation: 'El usuario pide "5 de supreme" (Manzana Golden de Primera) para hoy, lo que implica estado "Maduro". Especifica un destino "rampa en la C".', originalMessage: 'dame 5 de supreme para la rampa en la C', data: { productGroup: 'Manzana', variety: 'Golden', size: 'Primera', quality: 'Normal', state: 'Maduro', quantity: 5, unit: 'cajas', customer: 'Cliente Juan', destination: 'Rampa, Nave C', locationQuery: 'Rampa Nave C, Central de Abastos' }}},
    { id: `msg_approved_2`, sender: 'Cliente Ana', text: 'hola Fideo, mándame 10 cajas de aguacate Hass de segunda, que esté bueno', timestamp: new Date(), status: 'approved', interpretation: { type: InterpretationType.VENTA, certainty: 0.98, explanation: 'El cliente pide 10 cajas de Aguacate Hass de Segunda en estado "Maduro".', originalMessage: 'hola Fideo, mándame 10 cajas de aguacate Hass de segunda, que esté bueno', data: { productGroup: 'Aguacate', variety: 'Hass', size: 'Segunda', quality: 'Normal', state: 'Maduro', quantity: 10, unit: 'cajas', customer: 'Cliente Ana', destination: 'Puesto #23, Nave K' }}},
    { id: `msg_approved_po1`, sender: 'Admin', text: 'Fideo, pide 50 cajas de 10kg de hass de primera al güero', timestamp: new Date(), status: 'approved', interpretation: { type: InterpretationType.ORDEN_COMPRA, certainty: 0.99, explanation: 'Se solicita una orden de compra de 50 cajas de 10kg de Aguacate Hass de Primera al proveedor "El Güero de Michoacán".', originalMessage: 'Fideo, pide 50 cajas de 10kg de hass de primera al güero', data: { supplierName: "El Güero de Michoacán", productGroup: 'Aguacate', variety: 'Hass', size: 'Primera', quantity: 50, packaging: 'Caja 10kg' }}},
    { id: `msg_approved_4`, sender: 'Admin', text: 'la canica madura de aguacate está a 380', timestamp: new Date(), status: 'approved', interpretation: { type: InterpretationType.ACTUALIZACION_PRECIO, certainty: 1.0, explanation: 'El administrador está actualizando el precio del aguacate canica maduro.', originalMessage: 'la canica madura de aguacate está a 380', data: { productGroup: 'Aguacate', variety: 'Hass', size: 'Canica', quality: 'Normal', state: 'Maduro', price: 380, unit: 'cajas' }}},
    { id: `msg_approved_6`, sender: 'Empleado Pepe', text: 'Saca 10 cajas de aguacate canica verde a madurar', timestamp: new Date(), status: 'approved', interpretation: { type: InterpretationType.MOVIMIENTO_ESTADO, certainty: 0.99, explanation: 'El empleado pide mover 10 cajas de aguacate canica del estado "Verde" a "Entrado" para iniciar la maduración.', originalMessage: 'Saca 10 cajas de aguacate canica verde a madurar', data: { productGroup: 'Aguacate', variety: 'Hass', size: 'Canica', quality: 'Normal', quantity: 10, fromState: 'Verde', toState: 'Entrado' }}},
    { id: `msg_approved_asset_sale`, sender: 'Admin', text: 'El cliente Pedro se llevó una caja verde grande sin pagar', timestamp: new Date(), status: 'approved', interpretation: { type: InterpretationType.VENTA_ACTIVO_FIJO, certainty: 0.95, explanation: 'El cliente "Pedro" ha adquirido una "Caja Verde Grande" a crédito. Se debe registrar la venta y añadir el costo a su deuda.', originalMessage: 'El cliente Pedro se llevó una caja verde grande sin pagar', data: { customer: "Cliente Pedro", assetName: "Caja Grande Verde", quantity: 1 }}},
    { id: `msg_approved_8`, sender: 'Cliente Ana', text: 'me prestas 2 cajas grandes verdes?', timestamp: new Date(), status: 'approved', interpretation: { type: InterpretationType.PRESTAMO_CAJA, certainty: 0.9, explanation: 'La clienta "Ana" está pidiendo prestadas 2 cajas.', originalMessage: 'me prestas 2 cajas grandes verdes?', data: { customer: 'Cliente Ana', quantity: 2, description: 'Caja Grande Verde', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() }}},
    { id: `msg_approved_payment`, sender: 'Dani boy', text: 'oye te voy a dar 20 de aguacate extra maduro y abonarte 500 pesos', timestamp: new Date(), status: 'approved', interpretation: { type: InterpretationType.VENTA, certainty: 0.98, explanation: 'El cliente "Dani boy" pide 20 cajas de aguacate extra maduro. Además, tiene una deuda y la IA sugiere un abono de 500 pesos, que el cliente acepta.', originalMessage: 'oye te voy a dar 20 de aguacate extra maduro y abonarte 500 pesos', data: { productGroup: 'Aguacate', variety: 'Hass', size: 'Extra', quality: 'Normal', state: 'Maduro', quantity: 20, unit: 'cajas', customer: 'Dani boy', suggestedPayment: 500 }}},
];


export const INITIAL_FIXED_ASSETS: FixedAsset[] = [
    { id: 'fa1', name: 'Camión Isuzu', category: 'Vehículos', status: 'Operativo', purchaseDate: new Date('2022-00-15'), cost: 850000, metadata: { 'Placas': 'ABC-123', 'Capacidad': '3.5 Toneladas' }, photoUrl: 'https://www.isuzunorte.com.mx/images/modelos/elf-600/camion-elf-600-bus.png' },
    { id: 'fa2', name: 'Diablo de Carga #1', category: 'Equipo de Carga', status: 'Operativo', purchaseDate: new Date('2023-04-20'), cost: 1500, metadata: {} },
    { id: 'fa3', name: 'Cajas (Inventario)', category: 'Contenedores', status: 'Operativo', purchaseDate: new Date('2023-00-01'), cost: 20000, metadata: { 'Nota': 'El inventario y valor real se gestiona en la sección de cajas.' } },
    { id: 'fa4', name: 'Báscula Grande', category: 'Básculas', status: 'Dañado', purchaseDate: new Date('2021-10-10'), cost: 8000, metadata: { 'Capacidad': '500kg' } },
];
export const INITIAL_EXPENSES: Expense[] = [
    { id: 'ex1', description: 'Combustible Camión', amount: 1200, date: new Date(), category: 'Combustible', relatedAssetId: 'fa1' },
];

export const INITIAL_RIPENING_RULES: RipeningRule[] = [
    { id: 'rr1', varietyId: 'v3', fromState: 'Verde', toState: 'Entrado', days: 3 },
    { id: 'rr2', varietyId: 'v3', fromState: 'Entrado', toState: 'Maduro', days: 2 },
    { id: 'rr3', varietyId: 'v1', fromState: 'Verde', toState: 'Entrado', days: 4 },
];

export const INITIAL_MESSAGE_TEMPLATES: MessageTemplate[] = [
    {
        id: 'mt_ticket',
        type: 'ticket',
        name: 'Ticket Estándar',
        content: "*Fideo Frutas*\nTicket de Venta\n\nCliente: {nombre_cliente}\nTotal: {total}\n\nGracias por su compra.",
        variables: ['{nombre_cliente}', '{total}']
    },
    {
        id: 'mt_reminder',
        type: 'payment_reminder',
        name: 'Recordatorio Amable',
        content: "Hola {nombre_cliente}, te recordamos que tienes un saldo vencido de {total_deuda}. Agradecemos tu pronto pago.",
        variables: ['{nombre_cliente}', '{total_deuda}']
    },
    {
        id: 'mt_promo',
        type: 'promotion',
        name: 'Oferta General',
        content: "¡Hola {nombre_cliente}! Hoy tenemos {producto} a solo {precio}. ¡Aprovecha!",
        variables: ['{nombre_cliente}', '{producto}', '{precio}']
    }
];

export const INITIAL_SYSTEM_PROMPT = `Eres Fideo, un experto en logística, ventas y GESTIÓN DE CRÉDITO para un negocio mayorista de frutas en una central de abastos en México. También controlas la interfaz de esta aplicación. Tu trabajo es interpretar mensajes informales y convertirlos en datos JSON estructurados para ejecutar acciones complejas. Respondes a "Fideo".

CONOCIMIENTO DEL NEGOCIO:
- Productos: Manzana (Golden, Red), Aguacate (Hass), Mango (Tommy), Uva (Sin Semilla).
- Tamaños: Extra, Primera, Segunda, Tercera, Canica, Contra, Sin semilla.
- Calidades: 'Normal' (buen aspecto), 'Con Defectos' ("roña", daño cosmético), 'Merma' ("sapo", no apto para venta).
- Estados de Madurez: 'Verde', 'Entrado', 'Maduro', 'Suave'. 'Suave' es para consumo inmediato. Para Manzana Golden, 'Maduro' también es 'amarilla'.
- Activos Fijos: 'Diablo de Carga', 'Camión'.
- Tipos de Cajas (Activos): 'Caja Andrea (Grande)', 'Caja Recolección (Mediana)', 'Caja Aguacate Hass (10kg)', 'Moreliana'.
- Bodegas: 'Bodega Principal', 'Bodega Secundaria'.
- Empleados: 'Pepe', 'Luis', 'Carlos'.
- Clientes y Proveedores: Reconoces a los existentes.
- Empaques: 'Caja 10kg', 'Caja 25kg', 'Caja 20kg', 'Arpilla', 'Tonelada'.
- Jerga: "Supreme" es "Manzana Golden de tamaño Primera". "Poner a madurar" es mover de 'Verde' a 'Entrado'.

GESTIÓN DE CRÉDITO Y ACTIVOS:
- Si un cliente tiene una deuda significativa (>5000 MXN), DEBES añadir "suggestedPayment" a la 'data' de la venta, proponiendo un abono razonable (10-20% de la deuda).
- La aplicación RECHAZARÁ ventas a crédito para clientes 'Contado Solamente'.
- Un historial de no devolver cajas a tiempo reduce la confianza del cliente.
- Vender un activo (ej. "le vendí una caja grande verde") es "VENTA_ACTIVO_FIJO". El 'assetName' debe ser el nombre exacto del tipo de caja.
- Prestar un activo (ej. "se llevó una caja grande verde prestada") es "PRESTAMO_CAJA". La 'description' debe ser el nombre exacto del tipo de caja.

INSTRUCCIONES DE RESPUESTA:
- Responde SIEMPRE con un objeto JSON. No incluyas texto fuera del JSON.
- Usa la herramienta 'googleMaps' para identificar ubicaciones.
- Estructura: { "type": "TIPO_DE_ACCION", "certainty": 0.0-1.0, "explanation": "Tu razonamiento", "data": { ... } }.
- Tipos de Acción Válidos: "VENTA", "ORDEN_COMPRA", "VENTA_ACTIVO_FIJO", "ACTUALIZACION_PRECIO", "MOVIMIENTO_ESTADO", "MOVIMIENTO_CALIDAD", "TRANSFERENCIA_BODEGA", "ASIGNACION_ENTREGA", "PRESTAMO_CAJA", "LLEGADA_EMPLEADO", "CAMBIO_VISTA", "APLICAR_FILTRO", "CREAR_OFERTA", "CONSULTA", "DESCONOCIDO".

FORMATOS DE 'DATA' POR TIPO:
1. "VENTA": { "productGroup": "...", "variety": "...", "size": "...", "quality": "...", "state": "...", "quantity": num, "unit": "cajas", "customer": "nombre", "destination": "lugar", "locationQuery": "texto_para_mapa", "suggestedPayment": num (opcional) }. 'quality' por defecto es "Normal".
2. "ORDEN_COMPRA": { "supplierName": "...", "productGroup": "...", "variety": "...", "size": "...", "quantity": num, "packaging": "..." }.
3. "ACTUALIZACION_PRECIO": { "productGroup": "...", "variety": "...", "size": "...", "quality": "...", "state": "...", "price": num, "unit": "cajas" }.
4. "MOVIMIENTO_ESTADO": { "productGroup": "...", "variety": "...", "size": "...", "quality": "...", "quantity": num, "fromState": "estado", "toState": "estado" }.
5. "MOVIMIENTO_CALIDAD": { "productGroup": "...", "variety": "...", "size": "...", "state": "...", "quantity": num, "fromQuality": "calidad", "toQuality": "calidad" }.
6. "TRANSFERENCIA_BODEGA": { "productGroup": "...", "variety": "...", "size": "...", "quality": "...", "state": "...", "quantity": num, "fromWarehouseName": "nombre", "toWarehouseName": "nombre" }.
7. "ASIGNACION_ENTREGA": { "employeeName": "nombre", "customerName": "nombre" }.
8. "PRESTAMO_CAJA": { "customer": "nombre", "quantity": num, "description": "nombre exacto del tipo de caja", "dueDate": "YYYY-MM-DD" (calcula 3 días si no se especifica) }.
9. "LLEGADA_EMPLEADO": { "employee": "nombre" }.
10. "CAMBIO_VISTA": { "view": "vista_destino" }. Vistas: 'dashboard', 'messages', 'deliveries', 'salesLog', 'inventory', 'customers', 'suppliers', 'finances', 'history', 'training', 'settings', 'assets', 'promotions', 'ripening'.
11. "APLICAR_FILTRO": { "targetView": "vista_objetivo", "filterType": "tipo", "filterValue": "valor" }.
12. "CREAR_OFERTA": { "productDescription": "descripción simple", "price": num, "targetAudience": "a quién va dirigida" }.
13. "VENTA_ACTIVO_FIJO": { "customer": "nombre", "assetName": "nombre exacto del tipo de caja", "quantity": num }.
14. "CONSULTA": { "topic": "pregunta" }.
15. "DESCONOCIDO": {}. Si es ambiguo, usa este tipo.`;

export const INITIAL_CATEGORY_ICONS: Record<string, string> = {
    'Manzanas': '🍎',
    'Aguacates': '🥑',
    'Mangos': '🥭',
    'Uvas': '🍇'
};

export const INITIAL_SIZES: Record<string, { icon: string, archived: boolean }> = {
    'Extra': { icon: '💎', archived: false },
    'Primera': { icon: '🥇', archived: false },
    'Segunda': { icon: '🥈', archived: false },
    'Tercera': { icon: '🥉', archived: false },
    'Canica': { icon: '⚾', archived: false },
    'Contra': { icon: '🔄', archived: false },
    'Sin semilla': { icon: '🌱', archived: false }
};

export const INITIAL_QUALITIES: Record<Quality, { icon: string }> = {
    'Normal': { icon: '✅' },
    'Con Defectos': { icon: '🩹' },
    'Merma': { icon: '🗑️' }
};

export const INITIAL_STATE_ICONS: Record<string, string> = {
    'Verde': '🟢',
    'Entrado': '🟡',
    'Maduro': '🔴',
    'Suave': '🟤',
};
