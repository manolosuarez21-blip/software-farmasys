const { initDb, storage } = require('../config/db');
const { sqliteAll } = require('../utils/sqlite');

async function getSalesReport(req, res) {
  try {
    await initDb();
    let ventas = [];

    if (storage.mode === 'mongo') {
      ventas = await storage.mongoDb.collection('ventas').find({}).sort({ fecha: 1 }).toArray();
      ventas = ventas.map(v => ({ ...v, id: v._id.toString() }));
    } else {
      ventas = await sqliteAll(storage.sqliteDb, 'SELECT * FROM ventas ORDER BY fecha ASC');
    }

    // Agregación diaria
    const dailyMap = {};
    // Agregación mensual
    const monthlyMap = {};

    let totalVentasSum = 0;

    ventas.forEach(v => {
      const fecha = v.fecha || (v.created_at ? v.created_at.slice(0, 10) : 'Sin fecha');
      const mes = fecha.slice(0, 7); // YYYY-MM
      const total = Number(v.total || 0);
      const subtotal = Number(v.subtotal || total);
      const descuento = Number(v.descuento || 0);

      totalVentasSum += total;

      // Diaria
      if (!dailyMap[fecha]) {
        dailyMap[fecha] = { fecha, total: 0, subtotal: 0, descuentoSum: 0, cantidadVentas: 0 };
      }
      dailyMap[fecha].total += total;
      dailyMap[fecha].subtotal += subtotal;
      dailyMap[fecha].descuentoSum += descuento;
      dailyMap[fecha].cantidadVentas += 1;

      // Mensual
      if (!monthlyMap[mes]) {
        monthlyMap[mes] = { mes, total: 0, subtotal: 0, cantidadVentas: 0 };
      }
      monthlyMap[mes].total += total;
      monthlyMap[mes].subtotal += subtotal;
      monthlyMap[mes].cantidadVentas += 1;
    });

    const reportesDiarios = Object.values(dailyMap).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const reportesMensuales = Object.values(monthlyMap).sort((a, b) => a.mes.localeCompare(b.mes));

    const totalTransacciones = ventas.length;
    const ticketPromedio = totalTransacciones > 0 ? totalVentasSum / totalTransacciones : 0;

    res.json({
      ok: true,
      resumen: {
        totalVentas: totalVentasSum,
        totalTransacciones,
        ticketPromedio
      },
      diario: reportesDiarios,
      mensual: reportesMensuales
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}

async function getStockValuationReport(req, res) {
  try {
    await initDb();
    let productos = [];

    if (storage.mode === 'mongo') {
      productos = await storage.mongoDb.collection('productos').find({}).toArray();
      productos = productos.map(p => ({ ...p, id: p._id.toString() }));
    } else {
      productos = await sqliteAll(storage.sqliteDb, 'SELECT * FROM productos');
    }

    let totalCosto = 0;
    let totalVenta = 0;
    let totalStock = 0;
    const categoriaMap = {};

    const productosValorizados = productos.map(p => {
      const stock = Number(p.stock || 0);
      const costo = Number(p.costo || 0);
      const precio = Number(p.precio || 0);
      const valorCosto = stock * costo;
      const valorVenta = stock * precio;
      const gananciaEstimada = valorVenta - valorCosto;
      const cat = p.categoria || 'Sin categoría';

      totalCosto += valorCosto;
      totalVenta += valorVenta;
      totalStock += stock;

      if (!categoriaMap[cat]) {
        categoriaMap[cat] = {
          categoria: cat,
          totalCosto: 0,
          totalVenta: 0,
          gananciaEstimada: 0,
          totalStock: 0,
          cantidadProductos: 0
        };
      }
      categoriaMap[cat].totalCosto += valorCosto;
      categoriaMap[cat].totalVenta += valorVenta;
      categoriaMap[cat].gananciaEstimada += gananciaEstimada;
      categoriaMap[cat].totalStock += stock;
      categoriaMap[cat].cantidadProductos += 1;

      return {
        ...p,
        stock,
        costo,
        precio,
        valorCosto,
        valorVenta,
        gananciaEstimada
      };
    });

    const topProductosValor = [...productosValorizados]
      .sort((a, b) => b.valorVenta - a.valorVenta)
      .slice(0, 10);

    res.json({
      ok: true,
      resumen: {
        totalProductos: productos.length,
        totalStock,
        totalCosto,
        totalVenta,
        gananciaPotencial: totalVenta - totalCosto,
        margenPorcentaje: totalVenta > 0 ? ((totalVenta - totalCosto) / totalVenta) * 100 : 0
      },
      categorias: Object.values(categoriaMap),
      topProductos: topProductosValor,
      productos: productosValorizados
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}

module.exports = { getSalesReport, getStockValuationReport };
