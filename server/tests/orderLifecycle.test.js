import { describe, expect, it } from 'vitest';
import { validateOrderStatusTransition } from '../src/controllers/orderController.js';

describe('order lifecycle validation', () => {
  it('allows valid order status transitions', () => {
    expect(validateOrderStatusTransition('PENDING', 'CONFIRMED')).toBe(true);
    expect(validateOrderStatusTransition('CONFIRMED', 'PROCESSING')).toBe(true);
  });

  it('blocks invalid state changes', () => {
    expect(() => validateOrderStatusTransition('PENDING', 'DELIVERED')).toThrow(/Invalid order status transition/i);
    expect(() => validateOrderStatusTransition('CANCELLED', 'DELIVERED')).toThrow(/Invalid order status transition/i);
  });
});
