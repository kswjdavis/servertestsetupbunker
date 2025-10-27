import React from 'react';
import type { Bunker } from '../../types/api';

interface BunkerDeleteModalProps {
  bunker: Bunker;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function BunkerDeleteModal({
  bunker,
  isOpen,
  onConfirm,
  onCancel,
  loading = false
}: BunkerDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onCancel} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Icon */}
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Bunker
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to delete <strong>{bunker.name}</strong>? This action cannot be undone.
            </p>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-6">
              <p className="text-xs text-amber-800">
                <strong>Warning:</strong> Deleting this bunker will also remove all associated devices,
                status records, and historical data.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Deleting...' : 'Delete Bunker'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}