import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { prisma } from '../utils/db';

let adminToken: string;
let salesToken: string;
let opsToken: string;
let employeeToken: string;
let testClientId: string;
let testProjectId: string;

describe('Manufacturing ERP End-to-End Business Rules & API Test Suite', () => {
  beforeAll(async () => {
    // 1. Authenticate Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@mfgerp.com', password: 'Admin@123456' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;

    // 2. Authenticate Sales Manager
    const salesRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sales@mfgerp.com', password: 'Admin@123456' });
    expect(salesRes.status).toBe(200);
    salesToken = salesRes.body.token;

    // 3. Authenticate Operations Staff
    const opsRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ops@mfgerp.com', password: 'Admin@123456' });
    expect(opsRes.status).toBe(200);
    opsToken = opsRes.body.token;

    // 4. Authenticate Employee
    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee@mfgerp.com', password: 'Admin@123456' });
    expect(empRes.status).toBe(200);
    employeeToken = empRes.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. Rejects unauthenticated requests to protected routes', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('2. Enforces RBAC permissions: Employee cannot create projects or access payroll', async () => {
    const resPayroll = await request(app)
      .get('/api/payroll')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(resPayroll.status).toBe(403);
    expect(resPayroll.body.error).toBe('FORBIDDEN');

    const resProj = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ name: 'Hack Project' });
    expect(resProj.status).toBe(403);
  });

  it('3. Lead Management & Conversion: Converts Lead to Client with audit link', async () => {
    // Create Lead
    const leadRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        companyName: 'Apex Aero Technologies (Test Co)',
        contactPerson: 'Sanjay Dutt',
        email: 'sanjay@apexaero-test.com',
        phone: '+91 99887 76655',
        productRequirement: 'Titanium Rotor Hubs',
        expectedQty: 500,
        estimatedValue: 2500000,
      });
    expect(leadRes.status).toBe(201);
    const leadId = leadRes.body.id;

    // Convert Lead to Client
    const convertRes = await request(app)
      .post(`/api/leads/${leadId}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(convertRes.status).toBe(200);
    expect(convertRes.body.client).toBeDefined();
    expect(convertRes.body.lead.status).toBe('CONVERTED');

    testClientId = convertRes.body.client.id;

    // Prevent duplicate conversion
    const duplicateRes = await request(app)
      .post(`/api/leads/${leadId}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(duplicateRes.status).toBe(400);
    expect(duplicateRes.body.error).toBe('ALREADY_CONVERTED');
  });

  it('4. Project Management: Creates project and tracks specifications', async () => {
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientId: testClientId,
        name: 'Titanium Rotor Hub Production Order',
        productName: 'Titanium Rotor Hub Grade 5',
        orderedQty: 500,
        uom: 'PCS',
        unitSellingPrice: 5000,
        estimatedValue: 2500000,
        startDate: new Date().toISOString(),
        expectedCompletionDate: new Date(Date.now() + 86400000 * 30).toISOString(),
        priority: 'HIGH',
      });
    expect(projRes.status).toBe(201);
    testProjectId = projRes.body.id;
  });

  it('5. Production Validation: Logs valid production and rejects exceeding limits', async () => {
    const prodRes = await request(app)
      .post('/api/production')
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        projectId: testProjectId,
        product: 'Titanium Rotor Hub Grade 5',
        plannedQty: 300,
        producedQty: 300,
        productionDate: new Date().toISOString(),
        machineLine: 'Haas 5-Axis VF-4SS',
        materialCost: 600000,
        labourCost: 150000,
      });
    expect(prodRes.status).toBe(201);
    expect(prodRes.body.producedQty).toBe(300);

    // Over-production attempt exceeding 115% threshold (500 ordered -> max 575)
    // 300 already produced + 400 = 700 (> 575)
    const overProdRes = await request(app)
      .post('/api/production')
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        projectId: testProjectId,
        product: 'Titanium Rotor Hub Grade 5',
        plannedQty: 400,
        producedQty: 400,
        productionDate: new Date().toISOString(),
      });
    expect(overProdRes.status).toBe(400);
    expect(overProdRes.body.error).toBe('OVERPRODUCTION_EXCEEDED');
  });

  it('6. Quality Control Strict Reconciliation Rule: Inspected MUST equal Approved + Rejected + Rework', async () => {
    // Invalid breakdown: 300 inspected, but 250 + 40 = 290 (10 missing)
    const invalidQcRes = await request(app)
      .post('/api/quality')
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        projectId: testProjectId,
        inspectedQty: 300,
        approvedQty: 250,
        rejectedQty: 40,
        reworkQty: 0,
        inspectionDate: new Date().toISOString(),
      });
    expect(invalidQcRes.status).toBe(400);
    expect(invalidQcRes.body.error).toBe('QC_RECONCILIATION_FAILED');

    // Valid breakdown: 300 inspected = 285 approved + 10 rejected + 5 rework
    const validQcRes = await request(app)
      .post('/api/quality')
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        projectId: testProjectId,
        inspectedQty: 300,
        approvedQty: 285,
        rejectedQty: 10,
        reworkQty: 5,
        inspectionDate: new Date().toISOString(),
        notes: 'Ultrasonic flaw inspection passed for 285 units.',
      });
    expect(validQcRes.status).toBe(201);
    expect(validQcRes.body.approvedQty).toBe(285);
  });

  it('7. Delivery Dispatch Validation: Rejects delivery exceeding available quality-approved units', async () => {
    // Only 285 approved units exist. Attempting to dispatch 300 units must fail!
    const overDeliveryRes = await request(app)
      .post('/api/delivery')
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        projectId: testProjectId,
        deliveryQty: 300,
        deliveryAddress: 'Apex Aero Hangar 4, Bangalore',
        dispatchDate: new Date().toISOString(),
        expectedArrivalDate: new Date().toISOString(),
      });
    expect(overDeliveryRes.status).toBe(400);
    expect(overDeliveryRes.body.error).toBe('INSUFFICIENT_APPROVED_UNITS');

    // Valid dispatch: 150 units (< 285 approved)
    const validDelRes = await request(app)
      .post('/api/delivery')
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        projectId: testProjectId,
        deliveryQty: 150,
        deliveryAddress: 'Apex Aero Hangar 4, Bangalore',
        dispatchDate: new Date().toISOString(),
        expectedArrivalDate: new Date().toISOString(),
      });
    expect(validDelRes.status).toBe(201);
    expect(validDelRes.body.deliveryQty).toBe(150);
  });

  it('8. Financial Precision & Payments: Decimal invoicing, partial payments & outstanding balance recalculation', async () => {
    // Invoice for the 150 dispatched units @ 5,000 INR = 750,000 + 18% GST (135,000) = 885,000.00
    const invRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientId: testClientId,
        projectId: testProjectId,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 86400000 * 30).toISOString(),
        items: [
          {
            description: 'Titanium Rotor Hub Grade 5 (Lot 1)',
            quantity: 150,
            unitPrice: 5000,
          },
        ],
        taxRate: 18,
      });
    expect(invRes.status).toBe(201);
    expect(Number(invRes.body.totalAmount)).toBe(885000);
    expect(Number(invRes.body.outstandingBalance)).toBe(885000);
    const invoiceId = invRes.body.id;

    // Partial Payment of 500,000 INR
    const testIdempKey = 'IDEMP-TEST-' + Math.random().toString(36).substring(2, 10);
    const payRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoiceId,
        amount: 500000,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: 'NEFT-TEST-778899',
        idempotencyKey: testIdempKey,
      });
    expect(payRes.status).toBe(201);
    expect(payRes.body.updatedInvoice.status).toBe('PARTIALLY_PAID');
    expect(Number(payRes.body.updatedInvoice.amountReceived)).toBe(500000);
    expect(Number(payRes.body.updatedInvoice.outstandingBalance)).toBe(385000);

    // Prevent duplicate payment with same idempotency key
    const duplicatePayRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoiceId,
        amount: 500000,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: 'NEFT-TEST-778899',
        idempotencyKey: testIdempKey,
      });
    expect(duplicatePayRes.status).toBe(409);
    expect(duplicatePayRes.body.error).toBe('DUPLICATE_PAYMENT');
  });

  it('9. Dashboard and Activity Log: Real metrics calculated from database', async () => {
    const dashRes = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.operational.totalUnitsOrdered).toBeGreaterThanOrEqual(5500); // 5000 benchmark + 500 test
    expect(dashRes.body.financial.totalInvoicedRevenue).toBeGreaterThan(0);
    expect(dashRes.body.financial.totalCollectedRevenue).toBeGreaterThan(0);

    const actRes = await request(app)
      .get('/api/activity')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(actRes.status).toBe(200);
    expect(Array.isArray(actRes.body)).toBe(true);
    expect(actRes.body.length).toBeGreaterThan(0);
  });
});

