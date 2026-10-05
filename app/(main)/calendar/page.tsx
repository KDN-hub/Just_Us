"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, ArrowLeft, Clock, Video, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type CalendarEvent = {
  id: string;
  date_str: string;
  title: string;
  description: string;
  start_time?: string;
  end_time?: string;
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Set default selected date to today
  const initTodayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const [selectedDateStr, setSelectedDateStr] = useState<string>(initTodayStr);
  const [events, setEvents] = useState<Record<string, CalendarEvent[]>>({});
  
  // Add Event Full Page State
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const dragControls = useDragControls();
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  const [newEventStart, setNewEventStart] = useState("");
  const [newEventEnd, setNewEventEnd] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  
  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstDay = (firstDayRaw + 6) % 7; 
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase.from("calendar_events").select("*");
      if (data && !error) {
        const evMap: Record<string, CalendarEvent[]> = {};
        data.forEach((ev: any) => {
          if (!evMap[ev.date_str]) evMap[ev.date_str] = [];
          evMap[ev.date_str].push(ev);
        });
        // sort each day by start_time
        for (const k in evMap) {
          evMap[k].sort((a, b) => (a.start_time || "00:00").localeCompare(b.start_time || "00:00"));
        }
        setEvents(evMap);
      }
    }
    
    fetchEvents();
    
    // Real-time synchronization
    const channel = supabase.channel('calendar_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
        fetchEvents();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleAddEvent = async () => {
    if (!selectedDateStr || !newEventTitle.trim() || isSaving) return;
    setIsSaving(true);
    
    const newEv = {
      date_str: selectedDateStr,
      title: newEventTitle,
      description: newEventDesc,
      start_time: newEventStart,
      end_time: newEventEnd,
    };
    
    const { data, error } = await supabase.from("calendar_events").insert([newEv]).select();
    
    let addedEv = data ? data[0] : { ...newEv, id: Math.random().toString() };
    
    setEvents(prev => {
      const dayArr = [...(prev[selectedDateStr] || []), addedEv];
      dayArr.sort((a, b) => (a.start_time || "00:00").localeCompare(b.start_time || "00:00"));
      return { ...prev, [selectedDateStr]: dayArr };
    });
    
    setNewEventTitle("");
    setNewEventDesc("");
    setNewEventStart("");
    setNewEventEnd("");
    setIsSaving(false);
    setIsAddingEvent(false);
  };
  
  const handleDeleteEvent = async (id: string, dateStr: string) => {
    // Optimistic update: Instantly remove the event from the UI so it feels snappy!
    setEvents(prev => ({
      ...prev,
      [dateStr]: prev[dateStr].filter(e => e.id !== id)
    }));

    // Perform database deletion in the background
    await supabase.from("calendar_events").delete().eq("id", id);
  };

  const renderGrid = () => {
    const days = [];
    const totalCells = 42;
    const colors = ['bg-[#1EA1F2]', 'bg-[#FFB100]', 'bg-[#A855F7]', 'bg-[#FF3E6C]'];

    for (let i = 0; i < firstDay; i++) {
      const d = daysInPrevMonth - firstDay + i + 1;
      days.push(
        <div key={`prev-${i}`} className="relative flex aspect-[0.75] w-full flex-col items-center justify-start pt-[12px] bg-[#18181A] text-[17px] font-medium text-white/20">
          {d}
        </div>
      );
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = events[dateStr] || [];
      
      const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
      const isSelected = selectedDateStr === dateStr;
      
      days.push(
        <button
          key={`current-${d}`}
          onClick={() => {
            if (selectedDateStr === dateStr) {
              setIsAddingEvent(true);
            } else {
              setSelectedDateStr(dateStr);
            }
          }}
          className={`relative flex aspect-[0.75] w-full flex-col items-center justify-start pt-[8px] text-[17px] font-medium transition-all active:bg-white/5
            ${isSelected ? "bg-white/10 ring-1 ring-white ring-inset z-10" : "bg-[#18181A] hover:bg-white/5"}
          `}
        >
          <div className={`flex h-[34px] w-[34px] items-center justify-center rounded-full ${isSelected ? "bg-[var(--wine)] text-white" : isToday ? "text-[var(--gold)]" : "text-white/90"}`}>
            {d}
          </div>
          
          <div className="absolute bottom-3 flex w-full justify-center gap-[4px] px-1 flex-wrap">
            {dayEvents.slice(0, 3).map((ev, idx) => (
              <div key={idx} className={`h-[5px] w-[5px] rounded-full ${colors[idx % 4]}`} />
            ))}
            {dayEvents.length > 3 && <div className="h-[5px] w-[5px] rounded-full bg-white/50" />}
          </div>
        </button>
      );
    }
    
    const remainingCells = totalCells - (firstDay + daysInMonth);
    for (let i = 1; i <= remainingCells; i++) {
      days.push(
        <div key={`next-${i}`} className="relative flex aspect-[0.75] w-full flex-col items-center justify-start pt-[12px] bg-[#18181A] text-[17px] font-medium text-white/20">
          {i}
        </div>
      );
    }
    
    return days;
  };

  const selectedDateEvents = selectedDateStr ? (events[selectedDateStr] || []) : [];
  
  // Format selected date (e.g., "Thursday, Oct 12")
  const selectedDateFormatted = selectedDateStr 
    ? new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    : '';

  const eventColors = ['#1EA1F2', '#FFB100', '#A855F7', '#FF3E6C'];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative flex min-h-full w-full flex-col px-4 pt-[72px] pb-28"
    >
      
      {/* Calendar Grid Container */}
      <div className="mt-0 shrink-0">
        <div className="mb-6 flex items-center justify-between px-2">
          <h2 className="text-[28px] font-bold text-white flex items-center gap-2">
            {monthNames[month]} {year} <span className="text-white/40 text-[16px]">▼</span>
          </h2>
          <div className="flex gap-4 items-center text-white/70">
            <CalendarIcon className="h-5 w-5 opacity-60" />
            <div className="flex gap-2">
              <button onClick={handlePrevMonth} className="hover:text-white transition-colors"><ChevronLeft className="h-6 w-6" /></button>
              <button onClick={handleNextMonth} className="hover:text-white transition-colors"><ChevronRight className="h-6 w-6" /></button>
            </div>
          </div>
        </div>
        
        <div className="flex w-full justify-between px-2 mb-3">
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => (
            <div key={day} className="w-full text-center text-[11px] font-bold text-white/40 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>
        
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/10 backdrop-blur-xl shadow-2xl">
          <div className="grid grid-cols-7 gap-[1px]">
            {renderGrid()}
          </div>
        </div>
      </div>

      {/* Inline Event List for Selected Date */}
      <div className="mt-8 px-2 flex-1 flex flex-col">
        <h3 className="text-[18px] font-medium text-white mb-4">{selectedDateFormatted}</h3>
        
        {selectedDateEvents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-start pt-6">
            <p className="text-[16px] text-white/80 font-semibold tracking-wide">No events planned for today</p>
            <p className="text-[13px] text-white/40 mt-1 text-center px-4">Tap the date again to add a plan</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {selectedDateEvents.map((ev, idx) => (
              <div 
                key={ev.id} 
                className="relative flex items-stretch rounded-[20px] bg-[#18181A]/90 p-4 shadow-lg border border-white/5 group"
                style={{ borderLeftWidth: '6px', borderLeftColor: eventColors[idx % 4] }}
              >
                {/* Time Block */}
                <div className="w-[60px] shrink-0 flex flex-col items-start pt-0.5 border-r border-white/10 pr-3 mr-3">
                  <span className="text-[14px] font-bold text-white leading-none">{ev.start_time || "--:--"}</span>
                </div>
                
                {/* Details Block */}
                <div className="flex-1">
                  <h4 className="text-[16px] font-semibold text-white leading-tight">{ev.title}</h4>
                  {ev.description && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-white/50 text-[13px]">
                      {ev.description}
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={() => handleDeleteEvent(ev.id, ev.date_str)}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wine)] text-white shadow-md opacity-0 group-hover:opacity-100 transition-all md:opacity-100 active:scale-95"
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Add Plan Button directly in flow */}
        <button
          onClick={() => setIsAddingEvent(true)}
          className="mt-6 mb-12 w-full py-4 flex items-center justify-center gap-2 rounded-2xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-all active:scale-[0.98] shadow-md border border-white/5"
        >
          <Plus className="h-5 w-5" /> Add a plan
        </button>
      </div>

      {/* Add Event Bottom Sheet Slide-Up */}
      <AnimatePresence>
        {isAddingEvent && (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end font-sans">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsAddingEvent(false)}
            />
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragSnapToOrigin={true}
              dragListener={false}
              dragControls={dragControls}
              onDragEnd={(e, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  setIsAddingEvent(false);
                }
              }}
              className="relative flex h-[85vh] w-full flex-col rounded-t-[36px] bg-[var(--card)] shadow-[0_-8px_30px_rgba(0,0,0,0.5)] border-t border-white/5"
            >
              {/* Drag Handle Area */}
              <div 
                className="w-full flex flex-col items-center touch-none cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                {/* Pull indicator */}
                <div className="mx-auto mt-4 h-1.5 w-12 rounded-full bg-white/20" />

                {/* Header */}
                <div className="mt-4 px-6 pb-2 w-full flex items-center gap-4 min-h-[48px]">
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setIsAddingEvent(false)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wine)] text-white shadow-md transition-transform active:scale-95"
                  >
                    <ChevronLeft className="h-6 w-6 pr-[2px]" strokeWidth={3} />
                  </button>
                  <h1 className="text-[24px] font-bold text-white tracking-tight pointer-events-none">New Plan</h1>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32 flex flex-col gap-5">
                
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-white/50 uppercase tracking-wider pl-1">Plan Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Dinner Date"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#18181A] p-4 text-[16px] text-white outline-none placeholder:text-white/30 focus:border-[var(--wine)] focus:ring-1 focus:ring-[var(--wine)] transition-all shadow-sm"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-white/50 uppercase tracking-wider pl-1">Time</label>
                  <div className="relative">
                    <input
                      type="time"
                      value={newEventStart}
                      onChange={(e) => setNewEventStart(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-[#18181A] p-4 text-[16px] text-white outline-none focus:border-[var(--wine)] focus:ring-1 focus:ring-[var(--wine)] transition-all shadow-sm [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-white/50 uppercase tracking-wider pl-1">Details / Link</label>
                  <textarea
                    placeholder="Zoom link, location, or notes..."
                    value={newEventDesc}
                    onChange={(e) => setNewEventDesc(e.target.value)}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-[#18181A] p-4 text-[16px] text-white outline-none placeholder:text-white/30 focus:border-[var(--wine)] focus:ring-1 focus:ring-[var(--wine)] transition-all shadow-sm"
                    rows={3}
                  />
                </div>

                <button 
                  onClick={handleAddEvent}
                  disabled={!newEventTitle.trim() || isSaving}
                  className="mt-4 w-full rounded-[20px] bg-[var(--wine)] p-4 text-[16px] font-bold text-white shadow-lg transition-transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Plan"
                  )}
                </button>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

