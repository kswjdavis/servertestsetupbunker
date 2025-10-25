import React from 'react';
import { useNavigate } from 'react-router-dom';
import BunkerForm from '../components/bunker/BunkerForm';
import { useToast } from '../hooks/useToast';
import * as bunkerService from '../services/bunker.service';
import type { BunkerCreateRequest } from '../services/bunker.service';

export default function BunkerCreatePage() {
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();

  const handleSubmit = async (data: BunkerCreateRequest) => {
    try {
      const newBunker = await bunkerService.createBunker(data);
      showToast(`Bunker "${newBunker.name}" created successfully!`, 'success');
      setTimeout(() => {
        navigate(`/bunkers/${newBunker.id}`);
      }, 1500);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to create bunker',
        'error'
      );
      throw error;
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer />

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Back to dashboard"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Create New Bunker</h1>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <BunkerForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isEdit={false}
        />
      </div>
    </div>
  );
}