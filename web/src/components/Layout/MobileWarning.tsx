export default function MobileWarning() {
  return (
    <div className="md:hidden flex items-center justify-center h-screen bg-gray-100 p-6">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
        <svg 
          className="w-16 h-16 mx-auto mb-4 text-gray-400" 
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path 
            fillRule="evenodd" 
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" 
            clipRule="evenodd" 
          />
        </svg>
        <h2 className="text-xl font-bold mb-2">Tablet or Desktop Required</h2>
        <p className="text-gray-600">
          The Bunker Control System requires a tablet (768px+) or desktop for optimal operation.
          Please access from a larger device.
        </p>
      </div>
    </div>
  );
}