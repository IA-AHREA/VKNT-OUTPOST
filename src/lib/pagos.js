// src/lib/pagos.js
// Lógica compartida para aplicar un pago al saldo de un piloto:
// primero salda la deuda de sus outposts (el más deudor primero) y,
// si sobra monto, lo deja como saldo a favor en el último outpost tocado.
const { Prisma } = require('@prisma/client');
const prisma = require('../db/prisma');

async function aplicarMontoAOutpost(tx, outpost, monto, tipo, { ejecutadoPorDiscordId, motivo } = {}) {
  const nuevoSaldo = outpost.saldoIsk.plus(monto);
  await tx.outpost.update({
    where: { id: outpost.id },
    data: { saldoIsk: nuevoSaldo },
  });
  await tx.movimiento.create({
    data: {
      outpostId: outpost.id,
      pilotId: outpost.pilotId,
      tipo,
      monto,
      saldoPost: nuevoSaldo,
      motivo: motivo ?? null,
      ejecutadoPorDiscordId: ejecutadoPorDiscordId ?? null,
    },
  });
  outpost.saldoIsk = nuevoSaldo;
  return outpost;
}

async function aplicarPago(pilotId, amountPaid, opts = {}) {
  const montoInicial = new Prisma.Decimal(amountPaid);

  const nuevoSaldoTotal = await prisma.$transaction(async (tx) => {
    let remaining = montoInicial;

    const outpostsConDeuda = await tx.outpost.findMany({
      where: { pilotId, activo: true, saldoIsk: { lt: 0 } },
      orderBy: { saldoIsk: 'asc' },
    });

    let ultimoTocado = null;

    if (outpostsConDeuda.length === 0) {
      ultimoTocado = await tx.outpost.findFirst({ where: { pilotId, activo: true } });
    } else {
      for (const outpost of outpostsConDeuda) {
        if (remaining.lte(0)) break;
        const deuda = outpost.saldoIsk.abs();
        const pagoAEsteOutpost = Prisma.Decimal.min(remaining, deuda);
        await aplicarMontoAOutpost(tx, outpost, pagoAEsteOutpost, 'PAGO', opts);
        remaining = remaining.minus(pagoAEsteOutpost);
        ultimoTocado = outpost;
      }
    }

    if (remaining.gt(0) && ultimoTocado) {
      await aplicarMontoAOutpost(tx, ultimoTocado, remaining, 'PAGO', opts);
    }

    const agregado = await tx.outpost.aggregate({
      where: { pilotId, activo: true },
      _sum: { saldoIsk: true },
    });

    return agregado._sum.saldoIsk ?? new Prisma.Decimal(0);
  });

  return nuevoSaldoTotal;
}

module.exports = { aplicarPago, aplicarMontoAOutpost };
