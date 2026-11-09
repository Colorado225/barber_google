import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { OpeningHour } from '../../types';
import { getBranchHours, saveBranchHours } from '../../lib/branch-hours';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { Input } from '../../components/ui/input';
import { Clock, Save, Loader2 } from 'lucide-react';

interface BranchHoursManagerProps {
  salonId: string;
  branchId: string;
  branchName?: string;
}

const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export const BranchHoursManager: React.FC<BranchHoursManagerProps> = ({ salonId, branchId, branchName }) => {
  const { addToast } = useApp();
  const [hours, setHours] = useState<OpeningHour[]>(() =>
    daysOfWeek.map((day) => ({ day, isOpen: false, open: '', close: '' })),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const loadedHours = await getBranchHours(salonId, branchId);
        if (mounted) setHours(loadedHours);
      } catch (error) {
        if (mounted)
          setLoadError(error instanceof Error ? error.message : 'Impossible de charger les horaires.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [salonId, branchId, reloadCount]);

  const handleHourChange = (day: string, field: 'open' | 'close', value: string) => {
    setHours((currentHours) => currentHours.map((h) => (h.day === day ? { ...h, [field]: value } : h)));
  };

  const toggleDay = (day: string) => {
    setHours((currentHours) => currentHours.map((h) => (h.day === day ? { ...h, isOpen: !h.isOpen } : h)));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveBranchHours(salonId, branchId, hours);
      addToast(`Horaires de ${branchName || 'la succursale'} mis à jour.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible d’enregistrer les horaires.';
      setSaveError(message);
      addToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-[#161619] border-[#27272c]">
        <CardContent className="p-8 flex flex-col items-center gap-2 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Chargement des horaires…</span>
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="bg-[#161619] border-[#27272c]">
        <CardContent className="p-6 space-y-4">
          <p role="alert" className="text-sm text-red-300">
            {loadError}
          </p>
          <Button type="button" onClick={() => setReloadCount((count) => count + 1)}>
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#161619] border-[#27272c] text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#E5C378]">
          <Clock className="w-5 h-5" />
          Horaires d'Ouverture — {branchName || 'Succursale'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {saveError && (
          <p role="alert" className="mb-4 text-sm text-red-300">
            {saveError}
          </p>
        )}
        <div className="space-y-4">
          {hours.map((h) => (
            <div key={h.day} className="grid grid-cols-4 items-center gap-3 p-3 bg-[#111113] rounded-lg">
              <div className="font-semibold col-span-1">{h.day}</div>
              <div className="col-span-3 flex items-center gap-2">
                <Switch
                  checked={h.isOpen}
                  onCheckedChange={() => toggleDay(h.day)}
                  className="data-[state=checked]:bg-[#C9A45C]"
                />
                {h.isOpen ? (
                  <div className="flex items-center gap-2 w-full">
                    <Input
                      type="time"
                      value={h.open}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleHourChange(h.day, 'open', e.target.value)
                      }
                      className="bg-[#1c1c20] border-[#29292e] text-xs"
                    />
                    <span>-</span>
                    <Input
                      type="time"
                      value={h.close}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleHourChange(h.day, 'close', e.target.value)
                      }
                      className="bg-[#1c1c20] border-[#29292e] text-xs"
                    />
                  </div>
                ) : (
                  <div className="text-sm text-stone-400">Fermé</div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#C9A45C] hover:bg-[#E5C378] text-black disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Enregistrer les modifications
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
