-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('CARGO', 'PAGO', 'COBRO_MENSUAL', 'REGISTRO_INICIAL', 'AJUSTE');

-- CreateTable
CREATE TABLE "pilots" (
    "id" SERIAL NOT NULL,
    "discordId" TEXT NOT NULL,
    "nombreDiscord" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pilots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outposts" (
    "id" SERIAL NOT NULL,
    "pilotId" INTEGER NOT NULL,
    "nombreOutpost" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "saldoIsk" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outposts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "movimientos" (
    "id" SERIAL NOT NULL,
    "outpostId" INTEGER NOT NULL,
    "pilotId" INTEGER NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "saldoPost" DECIMAL(14,2) NOT NULL,
    "motivo" TEXT,
    "ejecutadoPorDiscordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pilots_discordId_key" ON "pilots"("discordId");

-- CreateIndex
CREATE INDEX "outposts_pilotId_idx" ON "outposts"("pilotId");

-- CreateIndex
CREATE INDEX "movimientos_outpostId_idx" ON "movimientos"("outpostId");

-- CreateIndex
CREATE INDEX "movimientos_pilotId_idx" ON "movimientos"("pilotId");

-- AddForeignKey
ALTER TABLE "outposts" ADD CONSTRAINT "outposts_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "pilots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_outpostId_fkey" FOREIGN KEY ("outpostId") REFERENCES "outposts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "pilots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
