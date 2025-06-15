
import React from "react";

interface Props {
  totalMilk: number;
  totalMilkAmount: number;
  totalGroceryAmount: number;
  totalMonthlyAmount: number;
  pendingBalance: number;
  grandTotal: number;
}

export const CustomerBillsSummary: React.FC<Props> = ({
  totalMilk,
  totalMilkAmount,
  totalGroceryAmount,
  totalMonthlyAmount,
  pendingBalance,
  grandTotal
}) => {
  return (
    <div className="bg-gray-50 rounded-2xl shadow-md p-4 sm:p-6 my-4 border-t border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Monthly Summary & Balance</h3>
      <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-600">Total Milk</span>
            <span className="text-lg font-bold text-blue-600">{totalMilk} L</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-600">Milk Amount</span>
            <span className="text-lg font-bold text-blue-600">{totalMilkAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-600">Grocery Amount</span>
            <span className="text-lg font-bold text-green-600">{totalGroceryAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b-2 border-gray-400">
            <span className="text-base font-semibold text-gray-700">Total Monthly Amount</span>
            <span className="text-xl font-bold text-purple-600">{totalMonthlyAmount.toFixed(2)}</span>
          </div>
        </div>
        <div className="space-y-3">
          {pendingBalance > 0 && (
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-600">Previous Balance</span>
              <span className="text-lg font-bold text-red-600">{pendingBalance.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-600">Current Month</span>
            <span className="text-lg font-bold text-purple-600">{totalMonthlyAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-3 bg-yellow-50 rounded-lg px-3 border-2 border-yellow-300">
            <span className="text-lg font-bold text-gray-800">GRAND TOTAL</span>
            <span className="text-2xl font-bold text-orange-600">{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
