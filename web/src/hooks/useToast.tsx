import { useState, useCallback } from 'react';
import Toast, { ToastType } from '../components/common/Toast';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const ToastContainer = () => (
    <>
      {toasts.map((toast, index) => (
        <div key={toast.id} style={{ top: `${(index * 80) + 20}px` }} className="fixed right-4 z-50">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </>
  );

  return {
    showToast,
    ToastContainer
  };
}