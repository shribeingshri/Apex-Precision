export type Role =
  | 'SUPER_ADMIN'
  | 'MANAGEMENT'
  | 'FINANCE_MANAGER'
  | 'PROJECT_MANAGER'
  | 'SALES_MANAGER'
  | 'OPERATIONS_STAFF'
  | 'EMPLOYEE';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  permissions: string[];
  employee?: {
    id: string;
    employeeCode: string;
    designation: string;
    department?: { name: string };
  };
}

export interface Department {
  id: string;
  name: string;
  description?: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  phone: string;
  departmentId?: string;
  department?: Department;
  designation: string;
  joiningDate: string;
  employmentStatus: string;
  user?: {
    id: string;
    email: string;
    role: Role;
  };
}

export interface Lead {
  id: string;
  leadCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  industry?: string;
  productRequirement: string;
  expectedQty: number;
  estimatedValue: string | number;
  leadSource?: string;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL_SENT' | 'NEGOTIATION' | 'CONVERTED' | 'LOST';
  followUpDate?: string;
  notes?: string;
  assignedEmployee?: { id: string; name: string; employeeCode: string };
  convertedClient?: { id: string; companyName: string; clientCode: string };
  createdAt: string;
}

export interface Client {
  id: string;
  clientCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  gstin?: string;
  industry?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LEAD_OPPORTUNITY';
  isArchived: boolean;
  accountManager?: { id: string; name: string; employeeCode: string };
  _count?: { projects: number; invoices: number; deliveries: number };
  financialSummary?: {
    totalInvoiced: number;
    totalReceived: number;
    outstandingBalance: number;
  };
  createdAt: string;
}

export interface Project {
  id: string;
  projectCode: string;
  clientId: string;
  client: { id: string; clientCode: string; companyName: string; email?: string; address?: string; gstin?: string };
  name: string;
  productName: string;
  productDescription?: string;
  specifications?: string;
  orderedQty: number;
  uom: string;
  unitSellingPrice: string | number;
  estimatedValue: string | number;
  projectManager?: { id: string; name: string; employeeCode: string };
  startDate: string;
  expectedCompletionDate: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status:
    | 'PLANNING'
    | 'APPROVED'
    | 'IN_PRODUCTION'
    | 'QUALITY_INSPECTION'
    | 'READY_FOR_DELIVERY'
    | 'PARTIALLY_DELIVERED'
    | 'COMPLETED'
    | 'ON_HOLD'
    | 'CANCELLED';
  stats?: {
    producedQty: number;
    approvedQty: number;
    deliveredQty: number;
    remainingDeliveryQty: number;
    productionProgress: number;
    deliveryProgress: number;
  };
}

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: string | number;
  total?: string | number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  client: { id: string; clientCode: string; companyName: string; email?: string; address?: string; gstin?: string };
  projectId?: string;
  project?: { id: string; projectCode: string; name: string };
  invoiceDate: string;
  dueDate: string;
  subtotal: string | number;
  discount?: string | number;
  taxRate: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  amountReceived: string | number;
  outstandingBalance: string | number;
  paymentTerms?: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  lineItems?: InvoiceItem[];
}

export interface Payment {
  id: string;
  paymentCode?: string;
  paymentNumber?: string;
  clientId: string;
  client?: { id: string; clientCode: string; companyName: string };
  invoiceId?: string;
  invoice?: { id: string; invoiceNumber: string; totalAmount: string | number };
  paymentDate: string;
  amount: string | number;
  paymentMethod: string;
  transactionReference: string;
  status?: string;
  notes?: string;
}

export interface Expense {
  id: string;
  expenseCode?: string;
  expenseNumber?: string;
  payee: string;
  date: string;
  category: string;
  amount: string | number;
  paymentMethod: string;
  reference?: string;
  projectId?: string;
  project?: { id: string; projectCode: string; name: string };
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string;
}

export interface PayrollRecord {
  id: string;
  payrollNumber?: string;
  employeeId: string;
  employee?: {
    id: string;
    employeeCode: string;
    name: string;
    designation: string;
    department?: { name: string };
  };
  payrollPeriod: string;
  basicSalary: string | number;
  allowances: string | number;
  bonus: string | number;
  overtime: string | number;
  deductions: string | number;
  netSalary: string | number;
  paymentDate?: string;
  paymentMethod?: string;
  status?: string;
}

export interface Retainer {
  id: string;
  retainerCode: string;
  clientId: string;
  client?: { id: string; clientCode: string; companyName: string };
  scope: string;
  contractValue: string | number;
  recurringFee: string | number;
  billingFrequency: string;
  startDate: string;
  renewalDate: string;
  estimatedDeliveryCosts: string | number;
  status: string;
}

export interface Task {
  id: string;
  taskCode?: string;
  title: string;
  description?: string;
  projectId?: string;
  project?: { id: string; projectCode: string; name: string };
  assignedEmployeeId?: string;
  assignedEmployee?: { id: string; name: string; employeeCode: string; designation?: string };
  priority: string;
  deadline?: string;
  status: string;
  progress?: number;
}

export interface Message {
  id: string;
  sender: string;
  recipient: string;
  content: string;
  clientId?: string;
  client?: { id: string; companyName: string };
  projectId?: string;
  project?: { id: string; name: string };
  timestamp: string;
  isInternal: boolean;
}

export interface EmailLog {
  id: string;
  recipient: string;
  sender: string;
  subject: string;
  messagePreview: string;
  category: string;
  status: string;
  sentAt?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId?: string;
  user?: { id: string; fullName: string; email: string };
  action: string;
  entityType: string;
  entityId: string;
  details?: string;
  timestamp: string;
  createdAt?: string;
}

export interface DashboardMetrics {
  operational: {
    activeProjects: number;
    totalUnitsOrdered: number;
    unitsInProduction: number;
    unitsQualityApproved: number;
    rejectedQuantities: number;
    reworkQuantities: number;
    pendingDeliveries: number;
    completedDeliveries: number;
    overdueProjects: number;
  };
  financial: {
    totalInvoicedRevenue: number;
    totalCollectedCash: number;
    outstandingReceivables: number;
    overdueInvoicesAmount: number;
    overdueInvoicesCount: number;
    recordedExpenses: number;
    payrollExpenditure: number;
    retainerRevenue: number;
    invoicedCount: number;
  };
  charts: {
    monthlyRevenue: Array<{ month: string; invoiced: number; collected: number }>;
    projectStatusDistribution: Array<{ status: string; count: number }>;
  };
  alerts: Array<{
    title: string;
    message: string;
    severity: 'INFO' | 'WARNING' | 'DANGER';
  }>;
}
