import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BunkerForm from '../components/bunker/BunkerForm';
import { useToast } from '../hooks/useToast';
import * as bunkerService from '../services/bunker.service';
import { mockBunkers } from '../services/mockData';
import type { Bunker } from '../types/api';
import type { BunkerUpdateRequest } from '../services/bunker.service';

export default function BunkerEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showToast, ToastContainer } = useToast();
  const [bunker, setBunker] = useState<Bunker | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBunker = async () => {
      if (!id) {
        navigate('/');
        return;
      }

      try {
        const data = await bunkerService.getBunker(id);
        setBunker(data);
      } catch (error) {
        console.error('Error fetching bunker:', error);
        // Use mock data as fallback
        const mockBunker = mockBunkers.find(b => b.id === id);
        if (mockBunker) {
          setBunker(mockBunker);
        } else {
          showToast('Bunker not found', 'error');
          navigate('/');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchBunker();
  }, [id, navigate, showToast]);

  const handleSubmit = async (data: BunkerUpdateRequest) => {
    if (!id) return;

    try {
      const updatedBunker = await bunkerService.updateBunker(id, data);
      showToast(`Bunker "${updatedBunker.name}" updated successfully!`, 'success');
      setTimeout(() => {
        navigate(`/bunkers/${updatedBunker.id}`);
      }, 1500);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to update bunker',
        'error'
      );
      throw error;
    }
  };

  const handleCancel = () => {
    navigate(`/bunkers/${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading bunker...</p>
        </div>
      </div>
    );
  }

  if (!bunker) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-semibold">Bunker not found</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer />

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/bunkers/${id}`)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Back to bunker"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Edit {bunker.name}</h1>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <BunkerForm
          bunker={bunker}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isEdit={true}
        />
      </div>
    </div>
  );
}