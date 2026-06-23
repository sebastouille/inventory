export * from "./auth";
export * from "./iam";
export * from "./listing";
export * from "./formatting";
export * from "./assets";
export * from "./equipment-movements";
export * from "./immobilizations";
export * from "./imports";
export * from "./spatial";
export * from "./organizations";
export * from "./health";
export * from "./dashboard";
export * from "./label-exports";
export * from "./inventory-campaigns";
export * from "./inventory-anomalies";
export * from "./reconciliation";
export * from "./global-search";
export * from "./bim-3d";
export * from "./password-policy";

export interface AuthContext {
  userId: string;
  organizationId: string;
  email: string;
}

export interface PaginationQuery {
  limit?: number;
  offset?: number;
}

export interface ProductListItem {
  id: string;
  sku: string;
  name: string;
  minStock: number;
  totalQuantity: number;
  active: boolean;
  categoryName: string | null;
  supplierName: string | null;
}

export interface ProductListQuery {
  page?: number;
  pageSize?: number;
  sort?: "name" | "sku" | "minStock" | "totalQuantity";
  direction?: "asc" | "desc";
  q?: string;
}

export interface LocationListItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  stockItemsCount: number;
  totalUnits: number;
}

export interface LocationListQuery {
  page?: number;
  pageSize?: number;
  sort?: "name" | "code" | "totalUnits";
  direction?: "asc" | "desc";
  q?: string;
}

export interface SupplierListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  productsCount: number;
}

export interface SupplierListQuery {
  page?: number;
  pageSize?: number;
  sort?: "name" | "email" | "productsCount";
  direction?: "asc" | "desc";
  q?: string;
}

export interface StockMovementListItem {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  createdAt: string;
  product: {
    id: string;
    sku: string;
    name: string;
  };
}

export interface StockMovementListQuery {
  page?: number;
  pageSize?: number;
  sort?: "createdAt" | "type" | "quantity";
  direction?: "asc" | "desc";
  q?: string;
}

export interface InventoryOverviewResponse {
  metrics: {
    products: number;
    locations: number;
    suppliers: number;
    totalUnits: number;
    lowStockCount: number;
  };
  lowStock: Array<{
    id: string;
    sku: string;
    name: string;
    minStock: number;
    quantity: number;
  }>;
  recentMovements: Array<{
    id: string;
    type: string;
    quantity: number;
    reason: string | null;
    createdAt: string;
    product: {
      id: string;
      sku: string;
      name: string;
    };
  }>;
}
