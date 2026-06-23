import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AssetsModule } from "./assets/assets.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { Bim3dModule } from "./bim-3d/bim-3d.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { HealthModule } from "./health/health.module";
import { GlobalSearchModule } from "./global-search/global-search.module";
import { IamModule } from "./iam/iam.module";
import { ImmobilizationsModule } from "./immobilizations/immobilizations.module";
import { EquipmentMovementsModule } from "./equipment-movements/equipment-movements.module";
import { ImportsModule } from "./imports/imports.module";
import { InventoryModule } from "./inventory/inventory.module";
import { InventoryAnomaliesModule } from "./inventory-anomalies/inventory-anomalies.module";
import { InventoryCampaignsModule } from "./inventory-campaigns/inventory-campaigns.module";
import { LabelExportsModule } from "./label-exports/label-exports.module";
import { LocationsModule } from "./locations/locations.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { PrismaModule } from "./prisma.module";
import { ProductsModule } from "./products/products.module";
import { ReconciliationModule } from "./reconciliation/reconciliation.module";
import { StockMovementsModule } from "./stock-movements/stock-movements.module";
import { SpatialModule } from "./spatial/spatial.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"]
    }),
    PrismaModule,
    AssetsModule,
    AuditModule,
    AuthModule,
    Bim3dModule,
    DashboardModule,
    GlobalSearchModule,
    HealthModule,
    IamModule,
    ImmobilizationsModule,
    EquipmentMovementsModule,
    ImportsModule,
    LabelExportsModule,
    OrganizationsModule,
    UsersModule,
    LocationsModule,
    SuppliersModule,
    ProductsModule,
    InventoryModule,
    InventoryCampaignsModule,
    InventoryAnomaliesModule,
    ReconciliationModule,
    StockMovementsModule,
    SpatialModule
  ]
})
export class AppModule {}
