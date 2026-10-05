"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar as CalendarIcon, Heart, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type CalendarEvent = {
  id: string;
  date_str: string;
  title: string;
  description: string;
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Record<string, CalendarEvent[]>>({});
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  
  // Modals/Forms
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  // Fetch events
  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase.from("calendar_events").select("*");
      if (data && !error) {
        const evMap: Record<string, CalendarEvent[]> = {};
        data.forEach((ev: any) => {
          if (!evMap[ev.date_str]) evMap[ev.date_str] = [];
          evMap[ev.date_str].push(ev);
        });
        setEvents(evMap);
      }
    }
    fetchEvents();
  }, []);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleAddEvent = async () => {
    if (!selectedDateStr || !newEventTitle.trim()) return;
    
    // Optimistic UI update or fallback if DB fails
    const newEv = {
      date_str: selectedDateStr,
      title: newEventTitle,
      description: newEventDesc,
    };
    
    // We try to save to supabase. If table doesn't exist, it will throw an error, so we gracefully fallback to local state for demo purposes.
    const { data, error } = await supabase.from("calendar_events").insert([newEv]).select();
    
    if (data && !error) {
      setEvents(prev => ({
        ...prev,
        [selectedDateStr]: [...(prev[selectedDateStr] || []), data[0]]
      }));
    } else {
      // Graceful fallback for local demo without DB table
      const fallbackId = Math.random().toString();
      setEvents(prev => ({
        ...prev,
        [selectedDateStr]: [...(prev[selectedDateStr] || []), { ...newEv, id: fallbackId }]
      }));
    }
    
    setNewEventTitle("");
    setNewEventDesc("");
    setIsAddingEvent(false);
  };
  
  const handleDeleteEvent = async (id: string, dateStr: string) => {
    await supabase.from("calendar_events").delete().eq("id", id);
    setEvents(prev => ({
      ...prev,
      [dateStr]: prev[dateStr].filter(e => e.id !== id)
    }));
  };

  const renderGrid = () => {
    const days = [];
    // empty slots
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10"></div>);
    }
    // days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = events[dateStr] || [];
      const hasEvents = dayEvents.length > 0;
      
      const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
      
      days.push(
        <button
          key={d}
          onClick={() => setSelectedDateStr(dateStr)}
          className={`relative flex h-12 w-full flex-col items-center justify-center rounded-xl text-[15px] font-medium transition-all active:scale-90
            ${isToday ? "bg-[var(--wine)] text-white shadow-md" : "text-white/80 hover:bg-white/10"}
            ${selectedDateStr === dateStr && !isToday ? "ring-2 ring-[var(--gold)]" : ""}
          `}
        >
          {d}
          {hasEvents && (
            <div className="absolute bottom-1.5 flex gap-0.5">
              <div className={`h-1 w-1 rounded-full ${isToday ? 'bg-white' : 'bg-[var(--gold)]'}`} />
            </div>
          )}
        </button>
      );
    }
    return days;
  };

  const selectedDateEvents = selectedDateStr ? (events[selectedDateStr] || []) : [];
  const selectedDateFormatted = selectedDateStr 
    ? new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

  return (
    <div className="relative flex min-h-full w-full flex-col p-6 pb-28">
      <div className="mt-12">
        <h1 className="text-[36px] font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-fraunces), serif" }}>
          Calendar
        </h1>
        <p className="text-white/70 mt-1">Our shared timeline.</p>
      </div>

      {/* Default Anniversary Item */}
      <div className="mt-8">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="relative overflow-hidden flex items-center gap-4 rounded-2xl border border-white/10 bg-[#18181A]/90 p-4 backdrop-blur-md shadow-lg"
        >
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-white/20 text-white">
            <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Nov</span>
            <span className="text-[22px] font-bold leading-none mt-0.5">7</span>
          </div>
          <div className="flex-1">
            <h2 className="text-[17px] font-semibold text-white flex items-center gap-2">
              Our Anniversary <Heart className="h-4 w-4 fill-red-500 text-red-500" />
            </h2>
            <p className="text-[14px] text-white/70 mt-0.5">Yearly celebration!</p>
          </div>
        </motion.div>
      </div>

      {/* Calendar Card */}
      <div className="mt-4 rounded-[28px] border border-white/10 bg-[#18181A]/90 p-5 backdrop-blur-xl shadow-xl">
        <div className="mb-4 flex items-center justify-between px-2">
          <h2 className="text-[18px] font-semibold text-white">
            {monthNames[month]} {year}
          </h2>
          <div className="flex gap-2">
            <button onClick={handlePrevMonth} className="rounded-full bg-white/5 p-2 hover:bg-white/10 text-white transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={handleNextMonth} className="rounded-full bg-white/5 p-2 hover:bg-white/10 text-white transition-colors">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-y-2 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-center text-[12px] font-medium text-white/40 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-y-2 gap-x-1">
          {renderGrid()}
        </div>
      </div>

      {/* Selected Date Bottom Sheet / Modal */}
      <AnimatePresence>
        {selectedDateStr && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/60 backdrop-blur-sm"
          >
            <div className="absolute inset-0" onClick={() => { setSelectedDateStr(null); setIsAddingEvent(false); }} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative flex h-[85vh] w-full flex-col rounded-t-[36px] border-t border-white/10 bg-[#18181A]/95 p-6 backdrop-blur-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.5)]"
            >
              <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-white/20" />
              
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[22px] font-bold text-white">{selectedDateFormatted}</h2>
                <button onClick={() => { setSelectedDateStr(null); setIsAddingEvent(false); }} className="rounded-full bg-white/10 p-2 text-white/60">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pb-20">
                {selectedDateEvents.length === 0 && !isAddingEvent ? (
                  <div className="flex flex-col items-center justify-center pt-10 opacity-50">
                    <CalendarIcon className="h-12 w-12 text-white/50 mb-3" />
                    <p className="text-[15px] text-white">No plans for this day yet.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {selectedDateEvents.map(ev => (
                      <div key={ev.id} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 group">
                        <h3 className="text-[16px] font-semibold text-white">{ev.title}</h3>
                        {ev.description && <p className="text-[14px] text-white/60 mt-1">{ev.description}</p>}
                        <button 
                          onClick={() => handleDeleteEvent(ev.id, ev.date_str)}
                          className="absolute right-4 top-4 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {isAddingEvent && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 rounded-2xl border border-[var(--gold)] bg-[var(--gold)]/10 p-4"
                  >
                    <input
                      type="text"
                      placeholder="Event Title"
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      className="w-full bg-transparent text-[16px] font-semibold text-white placeholder-white/40 outline-none mb-2"
                      autoFocus
                    />
                    <textarea
                      placeholder="Optional notes..."
                      value={newEventDesc}
                      onChange={(e) => setNewEventDesc(e.target.value)}
                      className="w-full resize-none bg-transparent text-[14px] text-white placeholder-white/40 outline-none"
                      rows={2}
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button onClick={() => setIsAddingEvent(false)} className="rounded-xl px-4 py-2 text-[14px] font-medium text-white/60">Cancel</button>
                      <button onClick={handleAddEvent} className="rounded-xl bg-[var(--gold)] px-4 py-2 text-[14px] font-bold text-black">Save</button>
                    </div>
                  </motion.div>
                )}
              </div>

              {!isAddingEvent && (
                <div className="absolute bottom-6 left-6 right-6">
                  <button
                    onClick={() => setIsAddingEvent(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white text-black py-4 font-bold shadow-lg active:scale-[0.98] transition-transform"
                  >
                    <Plus className="h-5 w-5" /> Add Plan
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
