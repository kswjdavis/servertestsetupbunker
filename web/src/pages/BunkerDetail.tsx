import { useParams } from 'react-router-dom';

export default function BunkerDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900">Bunker Detail</h1>
      <p className="mt-2 text-gray-600">
        Viewing bunker ID: {id}. Full implementation in Story 4.1.
      </p>
    </div>
  );
}