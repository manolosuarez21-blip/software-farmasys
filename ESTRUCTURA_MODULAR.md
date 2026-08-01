# 📁 Estructura Modular del Backend FARMAsys

El backend ha sido refactorizado de un monolito en `server.js` a una **arquitectura modular** bien organizada. Aquí está la ubicación de todos los módulos:

## 🏗️ Estructura de Carpetas

```
farmasys/
├── src/
│   ├── config/
│   │   └── db.js              # Inicialización de MongoDB y SQLite
│   ├── controllers/
│   │   ├── authController.js  # Login y health check
│   │   ├── productController.js
│   │   ├── saleController.js
│   │   ├── warehouseController.js
│   │   ├── supplierController.js
│   │   └── userController.js
│   ├── routes/
│   │   ├── auth.js            # Rutas de autenticación
│   │   ├── products.js        # Rutas de productos
│   │   ├── sales.js           # Rutas de ventas
│   │   ├── warehouse.js       # Rutas de bodega
│   │   ├── suppliers.js       # Rutas de distribuidores
│   │   └── users.js           # Rutas de usuarios
│   └── utils/
│       ├── env.js             # Cargador de .env
│       ├── sqlite.js          # Helpers para SQLite
│       └── objectid.js        # Conversión de MongoDB ObjectId
├── server.js                  # Punto de entrada (simplificado)
└── [otros archivos...]
```

## 📂 Qué hay en cada carpeta

### `src/config/`
- **db.js** - Gestiona la conexión a bases de datos (MongoDB con fallback a SQLite)

### `src/controllers/`
Contiene la lógica de negocio separada por dominio:
- `authController.js` - Login y health checks
- `productController.js` - CRUD de productos
- `saleController.js` - Creación y listado de ventas
- `warehouseController.js` - Movimientos de bodega
- `supplierController.js` - Gestión de distribuidores
- `userController.js` - Gestión de usuarios

### `src/routes/`
Define los endpoints API organizados por recurso:
- `auth.js` → POST `/api/login`, GET `/api/health`
- `products.js` → GET/POST/DELETE `/api/productos`
- `sales.js` → GET/POST `/api/ventas`
- `warehouse.js` → GET/POST `/api/bodega`
- `suppliers.js` → GET/POST/DELETE `/api/distribuidores`
- `users.js` → GET/POST/DELETE `/api/usuarios`

### `src/utils/`
Funciones auxiliares reutilizables:
- `env.js` - Lee y carga variables de entorno
- `sqlite.js` - Promisificaciones para callbacks de SQLite
- `objectid.js` - Convierte strings a ObjectId de MongoDB

### `server.js`
Punto de entrada simplificado:
- Configura Express
- Importa todas las rutas
- Registra middleware
- Inicia el servidor

## ✨ Ventajas de esta estructura

✅ **Separación de responsabilidades** - Cada módulo tiene una función clara  
✅ **Fácil mantenimiento** - Encontrar código es rápido  
✅ **Escalabilidad** - Agregar nuevas rutas es trivial  
✅ **Reutilizable** - Funciones helpers en `utils/`  
✅ **Testeable** - Controllers pueden testearse independientemente  

## 🚀 Para agregar una nueva funcionalidad

1. Crear controlador en `src/controllers/miControlador.js`
2. Crear rutas en `src/routes/miRuta.js`
3. Importar la ruta en `server.js` y registrar con `app.use()`

¡Mucho más limpio y mantenible! 🎉
