import { PrismaClient, Role, LeadStatus, ClientStatus, ProjectPriority, ProjectStatus, InspectionStatus, DeliveryStatus, InvoiceStatus, PaymentMethod, PaymentStatus, ExpenseCategory, ExpenseApprovalStatus, PayrollStatus, RetainerStatus, BillingFrequency, TaskPriority, TaskStatus, EmailStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Manufacturing ERP Database...');

  // 1. System Settings
  const settings = [
    { key: 'COMPANY_NAME', value: 'Apex Precision Engineering Ltd.', description: 'Operating Manufacturing Entity Name' },
    { key: 'COMPANY_GSTIN', value: '27AAACA1234A1Z5', description: 'Registered Goods & Services Tax Number' },
    { key: 'BASE_CURRENCY', value: 'INR', description: 'Primary System Currency Code' },
    { key: 'DEFAULT_TAX_RATE', value: '18.00', description: 'Standard GST / VAT Rate in Percent' },
    { key: 'INVOICE_PREFIX', value: 'INV-2026-', description: 'Standard Invoice Number Prefix' },
    { key: 'DELIVERY_PREFIX', value: 'DEL-2026-', description: 'Standard Delivery Dispatch Prefix' },
    { key: 'PRODUCTION_PREFIX', value: 'PRD-2026-', description: 'Batch Production Prefix' },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  // 2. Departments
  const departmentsData = [
    { name: 'Executive Management', description: 'Overall corporate strategy and operations oversight' },
    { name: 'Production & Manufacturing', description: 'Shop floor, CNC machining, fabrication and assembly' },
    { name: 'Quality Assurance & Control', description: 'Material testing, precision metrology and inspection' },
    { name: 'Supply Chain & Logistics', description: 'Procurement, inventory, packing and dispatch management' },
    { name: 'Finance & Accounts', description: 'Invoicing, receivables, payables, payroll and reconciliation' },
    { name: 'Sales & Client Relations', description: 'Lead acquisition, account management and contracts' },
    { name: 'Engineering & Design', description: 'CAD/CAM drafting, tooling design and process planning' },
  ];

  const deptMap: Record<string, string> = {};
  for (const d of departmentsData) {
    const dept = await prisma.department.upsert({
      where: { name: d.name },
      update: {},
      create: d,
    });
    deptMap[d.name] = dept.id;
  }

  // 3. Employees & Users for each Role
  const passwordHash = await bcrypt.hash('password123', 10);

  const employeesData = [
    {
      code: 'EMP-001',
      name: 'Rajesh Sharma',
      email: 'admin@apexprecision.com',
      phone: '+91 98200 11001',
      dept: 'Executive Management',
      designation: 'Managing Director & Super Admin',
      salary: 250000.00,
      role: Role.SUPER_ADMIN,
    },
    {
      code: 'EMP-002',
      name: 'Pooja Iyer',
      email: 'mgmt@apexprecision.com',
      phone: '+91 98200 11002',
      dept: 'Executive Management',
      designation: 'Chief Operating Officer',
      salary: 200000.00,
      role: Role.MANAGEMENT,
    },
    {
      code: 'EMP-003',
      name: 'Sunil Deshmukh',
      email: 'finance@apexprecision.com',
      phone: '+91 98200 11003',
      dept: 'Finance & Accounts',
      designation: 'Head of Finance & Accounts',
      salary: 150000.00,
      role: Role.FINANCE_MANAGER,
    },
    {
      code: 'EMP-004',
      name: 'Vikram Mehta',
      email: 'pm@apexprecision.com',
      phone: '+91 98200 11004',
      dept: 'Engineering & Design',
      designation: 'Senior Project Manager',
      salary: 130000.00,
      role: Role.PROJECT_MANAGER,
    },
    {
      code: 'EMP-005',
      name: 'Ananya Roy',
      email: 'sales@apexprecision.com',
      phone: '+91 98200 11005',
      dept: 'Sales & Client Relations',
      designation: 'Senior Client Relations Lead',
      salary: 110000.00,
      role: Role.SALES_MANAGER,
    },
    {
      code: 'EMP-006',
      name: 'Manoj Kumar',
      email: 'ops@apexprecision.com',
      phone: '+91 98200 11006',
      dept: 'Production & Manufacturing',
      designation: 'Shop Floor Plant Supervisor',
      salary: 85000.00,
      role: Role.OPERATIONS_STAFF,
    },
    {
      code: 'EMP-007',
      name: 'Kavita Patel',
      email: 'employee@apexprecision.com',
      phone: '+91 98200 11007',
      dept: 'Quality Assurance & Control',
      designation: 'Quality Metrology Specialist',
      salary: 70000.00,
      role: Role.EMPLOYEE,
    },
  ];

  const empMap: Record<string, string> = {};
  const userMap: Record<string, string> = {};

  for (const emp of employeesData) {
    const createdEmp = await prisma.employee.upsert({
      where: { email: emp.email },
      update: {},
      create: {
        employeeCode: emp.code,
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        departmentId: deptMap[emp.dept],
        designation: emp.designation,
        joiningDate: new Date('2023-01-15'),
        basicSalary: emp.salary,
      },
    });
    empMap[emp.code] = createdEmp.id;

    const user = await prisma.user.upsert({
      where: { email: emp.email },
      update: { role: emp.role },
      create: {
        email: emp.email,
        passwordHash,
        fullName: emp.name,
        role: emp.role,
        employeeId: createdEmp.id,
      },
    });
    userMap[emp.role] = user.id;
  }

  // 4. Clients
  const client1 = await prisma.client.upsert({
    where: { clientCode: 'CLI-1001' },
    update: {},
    create: {
      clientCode: 'CLI-1001',
      companyName: 'Bharat Heavy Dynamics Ltd. (Demo)',
      contactPerson: 'Mr. Arvind Saxena',
      email: 'arvind.saxena@bharatheavy-demo.com',
      phone: '+91 98110 54321',
      address: 'Plot 42, Industrial Area Phase II, Turbhe, Navi Mumbai - 400705',
      gstin: '27AAACB9876C1Z3',
      industry: 'Heavy Machinery & Aerospace Components',
      accountManagerId: empMap['EMP-005'],
      status: ClientStatus.ACTIVE,
      contacts: {
        create: [
          {
            name: 'Mr. Arvind Saxena',
            email: 'arvind.saxena@bharatheavy-demo.com',
            phone: '+91 98110 54321',
            designation: 'VP - Procurement',
            isPrimary: true,
          },
          {
            name: 'Ms. Geeta Nair',
            email: 'geeta.nair@bharatheavy-demo.com',
            phone: '+91 98110 54322',
            designation: 'Lead Quality Auditor',
            isPrimary: false,
          },
        ],
      },
    },
  });

  const client2 = await prisma.client.upsert({
    where: { clientCode: 'CLI-1002' },
    update: {},
    create: {
      clientCode: 'CLI-1002',
      companyName: 'Kaveri Automotive Components Pvt Ltd (Demo)',
      contactPerson: 'Suresh Ranganathan',
      email: 'suresh@kaveriauto-demo.com',
      phone: '+91 98400 67890',
      address: 'Industrial Estate, Ambattur, Chennai - 600058',
      gstin: '33AABCK3456D1Z2',
      industry: 'Automotive Sub-assemblies',
      accountManagerId: empMap['EMP-005'],
      status: ClientStatus.ACTIVE,
    },
  });

  // 5. Leads
  await prisma.lead.upsert({
    where: { leadCode: 'LEAD-2026-001' },
    update: {},
    create: {
      leadCode: 'LEAD-2026-001',
      companyName: 'Tata Power Transmission Systems (Demo)',
      contactPerson: 'Dinesh Kulkarni',
      email: 'dinesh.k@tatapower-demo.com',
      phone: '+91 99220 88776',
      industry: 'Power Generation & Grid Infrastructure',
      productRequirement: 'High-Tensile Galvanized Transmission Flanges',
      expectedQty: 2500,
      estimatedValue: 4500000.00,
      leadSource: 'Engineering Expo 2026',
      assignedEmployeeId: empMap['EMP-005'],
      status: LeadStatus.QUALIFIED,
      followUpDate: new Date(Date.now() + 86400000 * 3),
      notes: 'RFQ submitted. Technical clearance obtained from design team.',
    },
  });

  await prisma.lead.upsert({
    where: { leadCode: 'LEAD-2026-002' },
    update: {},
    create: {
      leadCode: 'LEAD-2026-002',
      companyName: 'Hydronix Valves & Pumps Ltd (Demo)',
      contactPerson: 'Meera Chidambaram',
      email: 'meera@hydronix-demo.com',
      phone: '+91 97400 33221',
      industry: 'Fluid Handling & Marine Equipment',
      productRequirement: 'SS-316 Cast Impeller Assemblies with Dynamic Balancing',
      expectedQty: 1000,
      estimatedValue: 1850000.00,
      leadSource: 'Direct Website Inquiry',
      assignedEmployeeId: empMap['EMP-005'],
      status: LeadStatus.PROPOSAL_SENT,
      followUpDate: new Date(Date.now() + 86400000 * 5),
      notes: 'Quotation revision sent with volume discount tiered at 1,000 units.',
    },
  });

  // 6. Project: The benchmark 5,000 unit order
  const project1 = await prisma.project.upsert({
    where: { projectCode: 'PRJ-2026-001' },
    update: {},
    create: {
      projectCode: 'PRJ-2026-001',
      clientId: client1.id,
      name: 'High-Precision CNC Impeller Manufacturing (Demo)',
      productName: 'AeroGrade SS-316 Turbo Impeller',
      productDescription: '5-Axis CNC machined stainless steel turbine impellers for aerospace turbines',
      specifications: 'Material: SS-316L, Surface Roughness: Ra 0.4µm, Dynamic Balance: ISO G1.0',
      orderedQty: 5000,
      uom: 'PCS',
      unitSellingPrice: 1200.00,
      estimatedValue: 6000000.00,
      projectManagerId: empMap['EMP-004'],
      startDate: new Date('2026-02-01'),
      expectedCompletionDate: new Date('2026-04-30'),
      priority: ProjectPriority.HIGH,
      status: ProjectStatus.IN_PRODUCTION,
      notes: 'Critical benchmark order. First phase 3,200 units scheduled.',
      assignments: {
        create: [
          { employeeId: empMap['EMP-004'], roleInProject: 'Lead Project Manager' },
          { employeeId: empMap['EMP-006'], roleInProject: 'Production Shift Supervisor' },
          { employeeId: empMap['EMP-007'], roleInProject: 'Quality Metrology Specialist' },
        ],
      },
    },
  });

  // 7. Production: 3,200 units produced
  const prod1 = await prisma.productionRecord.upsert({
    where: { batchNumber: 'PRD-BATCH-001' },
    update: {},
    create: {
      batchNumber: 'PRD-BATCH-001',
      projectId: project1.id,
      product: 'AeroGrade SS-316 Turbo Impeller',
      plannedQty: 3200,
      producedQty: 3200,
      productionDate: new Date('2026-02-15'),
      shift: 'Morning Shift A (06:00 - 14:00)',
      machineLine: 'Mazak 5-Axis CNC Line 2',
      assignedEmployeeId: empMap['EMP-006'],
      materialCost: 1440000.00,
      labourCost: 320000.00,
      otherCost: 80000.00,
      notes: 'Batch completed on schedule with zero machine downtime.',
    },
  });

  // 8. Quality Control: 3,200 units inspected (3,050 Approved, 150 Rejected)
  // Reconciled: 3200 = 3050 + 150 + 0
  const qc1 = await prisma.qualityInspection.upsert({
    where: { inspectionNumber: 'QC-2026-001' },
    update: {},
    create: {
      inspectionNumber: 'QC-2026-001',
      projectId: project1.id,
      productionRecordId: prod1.id,
      inspectedQty: 3200,
      approvedQty: 3050,
      rejectedQty: 150,
      reworkQty: 0,
      inspectionDate: new Date('2026-02-18'),
      inspectorId: empMap['EMP-007'],
      defectCategory: 'Dimensional tolerance deviation on blade pitch (>0.05mm)',
      status: InspectionStatus.PASSED,
      notes: '3,050 units meet CMM coordinate tolerance. 150 discarded due to forging porosity.',
    },
  });

  // 9. Delivery: 1,000 units delivered out of 3,050 approved (4,000 remaining on project)
  const del1 = await prisma.delivery.upsert({
    where: { deliveryNumber: 'DEL-2026-001' },
    update: {},
    create: {
      deliveryNumber: 'DEL-2026-001',
      projectId: project1.id,
      clientId: client1.id,
      product: 'AeroGrade SS-316 Turbo Impeller',
      deliveryQty: 1000,
      deliveryAddress: 'Bharat Heavy Dynamics Receiving Dock 3, Turbhe, Navi Mumbai',
      dispatchDate: new Date('2026-02-20'),
      expectedArrivalDate: new Date('2026-02-21'),
      actualDeliveryDate: new Date('2026-02-21'),
      transportReference: 'TRK-MAH-9872',
      vehicleDetails: 'Eicher Pro 2049 (MH-04-GP-4321)',
      assignedPersonnelId: empMap['EMP-006'],
      status: DeliveryStatus.DELIVERED,
      proofOfDeliveryUrl: 'https://storage.mfgerp.internal/pod/DEL-2026-001.pdf',
      notes: 'Partial dispatch lot 1 received in good condition, signed by Stores In-charge.',
    },
  });

  // 10. Billing & Invoice: Initial partial invoice for 1,000 delivered units
  // 1000 units * 1200 = 1,200,000 + 18% GST (216,000) = 1,416,000.00
  const inv1 = await prisma.invoice.upsert({
    where: { invoiceNumber: 'INV-2026-001' },
    update: {},
    create: {
      invoiceNumber: 'INV-2026-001',
      clientId: client1.id,
      projectId: project1.id,
      invoiceDate: new Date('2026-02-22'),
      dueDate: new Date('2026-03-24'),
      subtotal: 1200000.00,
      discount: 0.00,
      taxRate: 18.00,
      taxAmount: 216000.00,
      totalAmount: 1416000.00,
      amountReceived: 800000.00,
      outstandingBalance: 616000.00,
      paymentTerms: 'Net 30 Days',
      status: InvoiceStatus.PARTIALLY_PAID,
      notes: 'Milestone 1 invoice corresponding to delivery DEL-2026-001.',
      items: {
        create: [
          {
            description: 'AeroGrade SS-316 Turbo Impeller (Dispatch Batch 1)',
            quantity: 1000,
            unitPrice: 1200.00,
            lineTotal: 1200000.00,
          },
        ],
      },
    },
  });

  // 11. Payments: Partial payment of 800,000 INR against INV-2026-001
  await prisma.payment.upsert({
    where: { paymentNumber: 'PAY-2026-001' },
    update: {},
    create: {
      paymentNumber: 'PAY-2026-001',
      clientId: client1.id,
      invoiceId: inv1.id,
      projectId: project1.id,
      paymentDate: new Date('2026-02-25'),
      amount: 800000.00,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      transactionReference: 'NEFT-HDFC-9988221100',
      status: PaymentStatus.COMPLETED,
      notes: 'Advance part payment received for Delivery DEL-2026-001.',
      idempotencyKey: 'IDEMP-PAY-2026-001',
      allocations: {
        create: [
          {
            invoiceId: inv1.id,
            amount: 800000.00,
          },
        ],
      },
    },
  });

  // 12. Expenses: Project raw material and shop consumables
  await prisma.expense.upsert({
    where: { expenseNumber: 'EXP-2026-001' },
    update: {},
    create: {
      expenseNumber: 'EXP-2026-001',
      title: 'SS-316L Solid Round Bar Raw Material Stock (Batch 1)',
      vendor: 'Jindal Stainless Steel Stockists Ltd',
      date: new Date('2026-02-05'),
      category: ExpenseCategory.RAW_MATERIALS,
      amount: 1440000.00,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      reference: 'PO-RM-2026-88',
      projectId: project1.id,
      recordedById: userMap[Role.OPERATIONS_STAFF],
      approvalStatus: ExpenseApprovalStatus.APPROVED,
      approvedById: userMap[Role.FINANCE_MANAGER],
      notes: 'Certified mill test certificates verified for ASTM A276 standard.',
    },
  });

  await prisma.expense.upsert({
    where: { expenseNumber: 'EXP-2026-002' },
    update: {},
    create: {
      expenseNumber: 'EXP-2026-002',
      title: 'CNC Solid Carbide End Mills & Inserts Replenishment',
      vendor: 'Sandvik Coromant Tooling India',
      date: new Date('2026-02-12'),
      category: ExpenseCategory.MANUFACTURING,
      amount: 78500.00,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      reference: 'INV-SND-4491',
      projectId: project1.id,
      recordedById: userMap[Role.OPERATIONS_STAFF],
      approvalStatus: ExpenseApprovalStatus.APPROVED,
      approvedById: userMap[Role.FINANCE_MANAGER],
      notes: 'Dedicated tooling set allocated for 5-axis turbine impeller machining.',
    },
  });

  // 13. Payroll: Processed payroll for January 2026
  await prisma.payrollRecord.upsert({
    where: {
      employeeId_payrollPeriod: {
        employeeId: empMap['EMP-004'],
        payrollPeriod: '2026-01',
      },
    },
    update: {},
    create: {
      payrollNumber: 'PAYROLL-2026-01-004',
      employeeId: empMap['EMP-004'],
      payrollPeriod: '2026-01',
      basicSalary: 130000.00,
      allowances: 20000.00,
      bonus: 10000.00,
      overtime: 0.00,
      deductions: 18000.00, // PF + Professional Tax + TDS
      netSalary: 142000.00,
      paymentDate: new Date('2026-01-31'),
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      status: PayrollStatus.PAID,
      remarks: 'January regular salary disbursed via corporate payroll batch.',
    },
  });

  // 14. Retainer: Annual Precision Engineering Maintenance Contract
  await prisma.retainer.upsert({
    where: { retainerCode: 'RET-2026-001' },
    update: {},
    create: {
      retainerCode: 'RET-2026-001',
      clientId: client2.id,
      scope: 'Annual On-Demand Precision CNC Tooling Refurbishment & Re-balancing',
      contractValue: 1200000.00,
      recurringFee: 100000.00,
      billingFrequency: BillingFrequency.MONTHLY,
      startDate: new Date('2026-01-01'),
      renewalDate: new Date('2026-12-31'),
      accountManagerId: empMap['EMP-005'],
      estimatedDeliveryCosts: 350000.00,
      status: RetainerStatus.ACTIVE,
      notes: 'Active annual service agreement with guaranteed 48-hour turn-around SLA.',
    },
  });

  // 15. Tasks
  await prisma.task.upsert({
    where: { taskCode: 'TSK-101' },
    update: {},
    create: {
      taskCode: 'TSK-101',
      title: 'Program 5-Axis CAM toolpath for second batch impellers',
      description: 'Optimize trochoidal milling speeds to reduce cycle time by 8% per unit.',
      projectId: project1.id,
      assignedEmployeeId: empMap['EMP-004'],
      priority: TaskPriority.HIGH,
      deadline: new Date(Date.now() + 86400000 * 2),
      status: TaskStatus.IN_PROGRESS,
      progress: 65,
      createdById: userMap[Role.PROJECT_MANAGER],
    },
  });

  await prisma.task.upsert({
    where: { taskCode: 'TSK-102' },
    update: {},
    create: {
      taskCode: 'TSK-102',
      title: 'Coordinate CMM calibration with external metrology lab',
      description: 'Ensure quarterly ISO 17025 certification calibration is up to date.',
      assignedEmployeeId: empMap['EMP-007'],
      priority: TaskPriority.MEDIUM,
      deadline: new Date(Date.now() + 86400000 * 7),
      status: TaskStatus.TODO,
      progress: 10,
      createdById: userMap[Role.MANAGEMENT],
    },
  });

  // 16. Communications: Conversation and simulated Email Log
  const conv1 = await prisma.conversation.create({
    data: {
      title: 'Dispatch Lot 1 Confirmation & QC Certificates',
      category: 'CLIENT',
      clientId: client1.id,
      projectId: project1.id,
      messages: {
        create: [
          {
            senderName: 'Ananya Roy (Sales)',
            content: 'Dear Mr. Saxena, lot 1 (1,000 units) has been dispatched with delivery number DEL-2026-001. CMM calibration sheet attached.',
            isInternal: false,
          },
          {
            senderName: 'Mr. Arvind Saxena (Client)',
            content: 'Thank you Ananya. Consignment received at dock 3. Part payment of INR 8,00,000 initiated.',
            isInternal: false,
          },
        ],
      },
    },
  });

  await prisma.emailLog.create({
    data: {
      recipient: 'arvind.saxena@bharatheavy-demo.com',
      sender: 'notifications@mfgerp.internal',
      subject: 'Delivery Dispatch Notice: DEL-2026-001 (AeroGrade SS-316 Turbo Impeller)',
      messagePreview: 'Your consignment of 1,000 units has been dispatched via vehicle MH-04-GP-4321.',
      clientId: client1.id,
      projectId: project1.id,
      deliveryId: del1.id,
      category: 'DELIVERY_DISPATCH',
      status: EmailStatus.SIMULATED,
      providerResponse: 'SIMULATED: Ready for SMTP/SES transmission when integration keys configured.',
    },
  });

  // 17. Activity Logs
  const activityEvents = [
    { action: 'CREATE', entity: 'Client', entityId: client1.id, details: 'Created client Bharat Heavy Dynamics Ltd. (Demo)' },
    { action: 'CREATE', entity: 'Project', entityId: project1.id, details: 'Created project PRJ-2026-001 with 5,000 units ordered' },
    { action: 'RECORD_PRODUCTION', entity: 'ProductionRecord', entityId: prod1.id, details: 'Recorded production batch 1: 3,200 units produced' },
    { action: 'INSPECTION_RECORDED', entity: 'QualityInspection', entityId: qc1.id, details: 'Inspected 3,200 units: 3,050 Approved, 150 Rejected' },
    { action: 'DELIVERY_DISPATCH', entity: 'Delivery', entityId: del1.id, details: 'Dispatched 1,000 approved units to client dock' },
    { action: 'INVOICE_GENERATED', entity: 'Invoice', entityId: inv1.id, details: 'Generated invoice INV-2026-001 for INR 14,16,000.00' },
    { action: 'PAYMENT_RECORDED', entity: 'Payment', entityId: 'PAY-2026-001', details: 'Recorded payment of INR 8,00,000.00 via NEFT' },
  ];

  for (const act of activityEvents) {
    await prisma.activityLog.create({
      data: {
        userName: 'System Automation / Admin',
        action: act.action,
        entity: act.entity,
        entityId: act.entityId,
        details: act.details,
      },
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

