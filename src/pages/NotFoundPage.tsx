import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, LayoutDashboard, FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 text-center font-sans">
      <div className="max-w-md space-y-6">
        <div className="w-14 h-14 mx-auto rounded-[3px] bg-ivory-100 border border-stone-300 flex items-center justify-center text-copper shadow-xs">
          <Compass className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <div className="text-[10px] uppercase font-mono font-bold text-copper tracking-[0.2em]">
            404 — Document Not Located
          </div>
          <h2 className="font-serif text-3xl md:text-4xl font-normal text-obsidian tracking-tight">
            Uncharted Narrative
          </h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            The requested editorial route or document record does not exist within the BrandLens governance directory.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="primary"
            size="md"
            leftIcon={<LayoutDashboard className="w-4 h-4 text-copper" />}
            onClick={() => navigate('/dashboard')}
          >
            Return to Dashboard
          </Button>

          <Button
            variant="outline"
            size="md"
            leftIcon={<FileSearch className="w-4 h-4" />}
            onClick={() => navigate('/review')}
          >
            Open Content Workbench
          </Button>
        </div>
      </div>
    </div>
  );
};
