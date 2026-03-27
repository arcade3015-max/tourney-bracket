/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Trophy, ChevronRight, Settings2, Share2, Download, Users, Play, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Participant, Match, Tournament } from './types';

// Helper to generate a unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

export default function App() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [tournamentName, setTournamentName] = useState('My Tournament');
  const [matches, setMatches] = useState<Match[]>([]);
  const [isStarted, setIsStarted] = useState(false);

  // Add a participant
  const addParticipant = () => {
    if (!newParticipantName.trim()) return;
    setParticipants([...participants, { id: generateId(), name: newParticipantName.trim() }]);
    setNewParticipantName('');
  };

  // Remove a participant
  const removeParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  // Start the tournament
  const startTournament = () => {
    if (participants.length < 2) return;

    // Shuffle participants for random seeding
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    
    // Calculate number of rounds needed for Winners Bracket
    const numParticipants = shuffled.length;
    const numRoundsW = Math.ceil(Math.log2(numParticipants));
    const totalSlots = Math.pow(2, numRoundsW);
    
    const initialMatches: Match[] = [];
    
    // 1. Winners Bracket
    for (let r = 0; r < numRoundsW; r++) {
      const matchesInRound = Math.pow(2, numRoundsW - r - 1);
      for (let i = 0; i < matchesInRound; i++) {
        initialMatches.push({
          id: `w-r${r}-m${i}`,
          round: r,
          position: i,
          participant1Id: null,
          participant2Id: null,
          score1: '',
          score2: '',
          winnerId: null,
          loserId: null,
          bracketType: 'winners'
        });
      }
    }

    // Fill first round of winners bracket
    const firstRoundMatches = initialMatches.filter(m => m.bracketType === 'winners' && m.round === 0);
    firstRoundMatches.forEach((match, i) => {
      match.participant1Id = shuffled[i * 2]?.id || null;
      match.participant2Id = shuffled[i * 2 + 1]?.id || null;
      
      // Handle byes
      if (match.participant1Id && !match.participant2Id) {
        match.winnerId = match.participant1Id;
        // Progress to next round
        const nextMatch = initialMatches.find(m => m.bracketType === 'winners' && m.round === 1 && m.position === Math.floor(match.position / 2));
        if (nextMatch) {
          if (match.position % 2 === 0) nextMatch.participant1Id = match.participant1Id;
          else nextMatch.participant2Id = match.participant1Id;
        }
      }
    });

    // 2. Losers Bracket
    const numRoundsL = numRoundsW - 1;
    if (numRoundsL >= 0) {
      for (let r = 0; r < numRoundsL; r++) {
        const matchesInRound = Math.pow(2, numRoundsL - r - 1);
        for (let i = 0; i < matchesInRound; i++) {
          initialMatches.push({
            id: `l-r${r}-m${i}`,
            round: r,
            position: i,
            participant1Id: null,
            participant2Id: null,
            score1: '',
            score2: '',
            winnerId: null,
            loserId: null,
            bracketType: 'losers'
          });
        }
      }
    }

    // 3. Grand Finals
    initialMatches.push({
      id: `gf-m0`,
      round: 0,
      position: 0,
      participant1Id: null,
      participant2Id: null,
      score1: '',
      score2: '',
      winnerId: null,
      loserId: null,
      bracketType: 'grand-finals'
    });

    setMatches(initialMatches);
    setIsStarted(true);
  };

  // Update score
  const updateScore = (matchId: string, participantNum: 1 | 2, score: string) => {
    setMatches(prev => {
      const updated = prev.map(m => {
        if (m.id === matchId) {
          return {
            ...m,
            [participantNum === 1 ? 'score1' : 'score2']: score
          };
        }
        return m;
      });

      // Auto-progression logic
      const currentMatch = updated.find(m => m.id === matchId);
      if (currentMatch && currentMatch.participant1Id && currentMatch.participant2Id) {
        const s1 = parseInt(currentMatch.score1 || '');
        const s2 = parseInt(currentMatch.score2 || '');

        if (!isNaN(s1) && !isNaN(s2)) {
          if (s1 > s2) {
            return selectWinnerInternal(updated, matchId, currentMatch.participant1Id);
          } else if (s2 > s1) {
            return selectWinnerInternal(updated, matchId, currentMatch.participant2Id);
          } else {
            // It's a draw, clear winner if it was set
            return selectWinnerInternal(updated, matchId, null);
          }
        }
      }
      return updated;
    });
  };

  // Internal version of selectWinner that works with a provided matches array
  const selectWinnerInternal = (currentMatches: Match[], matchId: string, winnerId: string | null) => {
    const matchIndex = currentMatches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) return currentMatches;

    const updatedMatches = [...currentMatches];
    const currentMatch = { ...updatedMatches[matchIndex] };
    
    // Determine loser
    let loserId: string | null = null;
    if (winnerId) {
      loserId = winnerId === currentMatch.participant1Id ? currentMatch.participant2Id : currentMatch.participant1Id;
    }

    // Update winner and loser
    currentMatch.winnerId = winnerId;
    currentMatch.loserId = loserId;
    updatedMatches[matchIndex] = currentMatch;

    // 1. Winners Bracket Progression
    if (currentMatch.bracketType === 'winners') {
      const nextRound = currentMatch.round + 1;
      const nextPosition = Math.floor(currentMatch.position / 2);
      const isFirstInNext = currentMatch.position % 2 === 0;

      const nextMatchIndex = updatedMatches.findIndex(m => m.bracketType === 'winners' && m.round === nextRound && m.position === nextPosition);
      
      if (nextMatchIndex !== -1) {
        // Move winner to next winners match
        const nextMatch = { ...updatedMatches[nextMatchIndex] };
        if (isFirstInNext) nextMatch.participant1Id = winnerId;
        else nextMatch.participant2Id = winnerId;
        nextMatch.winnerId = null;
        updatedMatches[nextMatchIndex] = nextMatch;
        clearSubsequentRoundsInternal(updatedMatches, 'winners', nextRound, nextPosition);
      } else {
        // This was the last winners match, move to grand finals
        const gfMatchIndex = updatedMatches.findIndex(m => m.bracketType === 'grand-finals');
        if (gfMatchIndex !== -1) {
          const gfMatch = { ...updatedMatches[gfMatchIndex] };
          gfMatch.participant1Id = winnerId;
          gfMatch.winnerId = null;
          updatedMatches[gfMatchIndex] = gfMatch;
        }
      }

      // Move loser to losers bracket (only from Round 0 for this simplified version)
      if (currentMatch.round === 0) {
        const lMatchIndex = updatedMatches.findIndex(m => m.bracketType === 'losers' && m.round === 0 && m.position === Math.floor(currentMatch.position / 2));
        if (lMatchIndex !== -1) {
          const lMatch = { ...updatedMatches[lMatchIndex] };
          if (currentMatch.position % 2 === 0) lMatch.participant1Id = loserId;
          else lMatch.participant2Id = loserId;
          lMatch.winnerId = null;
          updatedMatches[lMatchIndex] = lMatch;
          clearSubsequentRoundsInternal(updatedMatches, 'losers', 0, Math.floor(currentMatch.position / 2));
        }
      }
    }

    // 2. Losers Bracket Progression
    if (currentMatch.bracketType === 'losers') {
      const nextRound = currentMatch.round + 1;
      const nextPosition = Math.floor(currentMatch.position / 2);
      const isFirstInNext = currentMatch.position % 2 === 0;

      const nextMatchIndex = updatedMatches.findIndex(m => m.bracketType === 'losers' && m.round === nextRound && m.position === nextPosition);
      
      if (nextMatchIndex !== -1) {
        const nextMatch = { ...updatedMatches[nextMatchIndex] };
        if (isFirstInNext) nextMatch.participant1Id = winnerId;
        else nextMatch.participant2Id = winnerId;
        nextMatch.winnerId = null;
        updatedMatches[nextMatchIndex] = nextMatch;
        clearSubsequentRoundsInternal(updatedMatches, 'losers', nextRound, nextPosition);
      } else {
        // This was the last losers match, move to grand finals
        const gfMatchIndex = updatedMatches.findIndex(m => m.bracketType === 'grand-finals');
        if (gfMatchIndex !== -1) {
          const gfMatch = { ...updatedMatches[gfMatchIndex] };
          gfMatch.participant2Id = winnerId;
          gfMatch.winnerId = null;
          updatedMatches[gfMatchIndex] = gfMatch;
        }
      }
    }

    return updatedMatches;
  };

  const clearSubsequentRoundsInternal = (allMatches: Match[], bracketType: 'winners' | 'losers', round: number, position: number) => {
    let currentRound = round + 1;
    let currentPos = Math.floor(position / 2);
    let isFirst = position % 2 === 0;

    while (true) {
      const nextMatchIndex = allMatches.findIndex(m => m.bracketType === bracketType && m.round === currentRound && m.position === currentPos);
      
      if (nextMatchIndex === -1) {
        // We reached the end of the bracket, check grand finals
        const gfMatchIndex = allMatches.findIndex(m => m.bracketType === 'grand-finals');
        if (gfMatchIndex !== -1) {
          const gfMatch = { ...allMatches[gfMatchIndex] };
          if (bracketType === 'winners') {
            gfMatch.participant1Id = null;
          } else {
            gfMatch.participant2Id = null;
          }
          gfMatch.winnerId = null;
          allMatches[gfMatchIndex] = gfMatch;
        }
        break;
      }

      const nextMatch = { ...allMatches[nextMatchIndex] };
      if (isFirst) nextMatch.participant1Id = null;
      else nextMatch.participant2Id = null;
      
      nextMatch.winnerId = null;
      allMatches[nextMatchIndex] = nextMatch;
      
      isFirst = currentPos % 2 === 0;
      currentPos = Math.floor(currentPos / 2);
      currentRound++;
    }
  };

  // Reset tournament
  const resetTournament = () => {
    setIsStarted(false);
    setMatches([]);
  };

  // Select winner and advance (UI triggered)
  const selectWinner = (matchId: string, winnerId: string | null) => {
    setMatches(prev => selectWinnerInternal(prev, matchId, winnerId));
  };

  const winnersRounds = useMemo(() => {
    const winnersMatches = matches.filter(m => m.bracketType === 'winners');
    if (winnersMatches.length === 0) return [];
    const maxRound = Math.max(...winnersMatches.map(m => m.round));
    const r = [];
    for (let i = 0; i <= maxRound; i++) {
      r.push(winnersMatches.filter(m => m.round === i).sort((a, b) => a.position - b.position));
    }
    return r;
  }, [matches]);

  const losersRounds = useMemo(() => {
    const losersMatches = matches.filter(m => m.bracketType === 'losers');
    if (losersMatches.length === 0) return [];
    const maxRound = Math.max(...losersMatches.map(m => m.round));
    const r = [];
    for (let i = 0; i <= maxRound; i++) {
      r.push(losersMatches.filter(m => m.round === i).sort((a, b) => a.position - b.position));
    }
    return r;
  }, [matches]);

  const grandFinalsMatch = useMemo(() => {
    return matches.find(m => m.bracketType === 'grand-finals');
  }, [matches]);

  const getParticipantName = (id: string | null) => {
    if (!id) return "TBD";
    return participants.find(p => p.id === id)?.name || "Unknown";
  };

  const renderBracket = (rounds: Match[][], title: string) => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h3 className="text-xl font-bold tracking-tight text-[#1C1917]">{title}</h3>
        <div className="h-[1px] flex-1 bg-[#E7E5E4]" />
      </div>
      <div className="overflow-x-auto pb-10 custom-scrollbar">
        <div className="inline-flex gap-16 p-4">
          {rounds.map((roundMatches, roundIndex) => (
            <div key={roundIndex} className="flex flex-col justify-around gap-8 min-w-[280px]">
              <div className="text-center mb-4">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#A8A29E]">
                  {roundIndex === rounds.length - 1 ? 'Finals' : 
                   roundIndex === rounds.length - 2 ? 'Semi-Finals' : 
                   roundIndex === rounds.length - 3 ? 'Quarter-Finals' : 
                   `Round ${roundIndex + 1}`}
                </span>
              </div>
              
              {roundMatches.map((match) => (
                <div key={match.id} className="relative group">
                  {/* Match Card */}
                  <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 w-full min-w-[240px]">
                    <div className="flex items-center">
                      <button 
                        onClick={() => match.participant1Id && selectWinner(match.id, match.participant1Id)}
                        disabled={!match.participant1Id}
                        className={`flex-1 flex items-center justify-between px-4 py-3 text-left transition-colors ${
                          match.winnerId === match.participant1Id ? 'bg-[#1C1917] text-white' : 
                          match.winnerId && match.winnerId !== match.participant1Id ? 'opacity-40' : 
                          'hover:bg-[#F5F5F4]'
                        }`}
                      >
                        <span className="font-medium truncate mr-2">{getParticipantName(match.participant1Id)}</span>
                        {match.winnerId === match.participant1Id && <Trophy className="w-4 h-4 flex-shrink-0" />}
                      </button>
                      <input 
                        type="text"
                        value={match.score1 || ''}
                        onChange={(e) => updateScore(match.id, 1, e.target.value)}
                        placeholder="0"
                        className={`w-12 h-full py-3 text-center font-mono text-sm border-l border-[#E7E5E4] outline-none focus:bg-[#F5F5F4] transition-colors ${
                          match.winnerId === match.participant1Id ? 'bg-[#292524] text-white border-[#44403C]' : 'bg-white'
                        }`}
                      />
                    </div>
                    
                    <div className="h-[1px] bg-[#E7E5E4]" />
                    
                    <div className="flex items-center">
                      <button 
                        onClick={() => match.participant2Id && selectWinner(match.id, match.participant2Id)}
                        disabled={!match.participant2Id}
                        className={`flex-1 flex items-center justify-between px-4 py-3 text-left transition-colors ${
                          match.winnerId === match.participant2Id ? 'bg-[#1C1917] text-white' : 
                          match.winnerId && match.winnerId !== match.participant2Id ? 'opacity-40' : 
                          'hover:bg-[#F5F5F4]'
                        }`}
                      >
                        <span className="font-medium truncate mr-2">{getParticipantName(match.participant2Id)}</span>
                        {match.winnerId === match.participant2Id && <Trophy className="w-4 h-4 flex-shrink-0" />}
                      </button>
                      <input 
                        type="text"
                        value={match.score2 || ''}
                        onChange={(e) => updateScore(match.id, 2, e.target.value)}
                        placeholder="0"
                        className={`w-12 h-full py-3 text-center font-mono text-sm border-l border-[#E7E5E4] outline-none focus:bg-[#F5F5F4] transition-colors ${
                          match.winnerId === match.participant2Id ? 'bg-[#292524] text-white border-[#44403C]' : 'bg-white'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Connection Lines */}
                  {roundIndex < rounds.length - 1 && (
                    <div className="absolute top-1/2 -right-16 w-16 h-[2px] bg-[#D6D3D1] pointer-events-none">
                      <div className={`absolute right-0 w-[2px] bg-[#D6D3D1] ${
                        match.position % 2 === 0 
                          ? 'h-[calc(50%+32px)] top-0' 
                          : 'h-[calc(50%+32px)] bottom-0'
                      }`} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#1C1917] font-sans selection:bg-[#D6D3D1]">
      {/* Header */}
      <header className="border-b border-[#E7E5E4] bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#1C1917] rounded flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Bracket Master</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {isStarted && (
              <button 
                onClick={resetTournament}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#78716C] hover:text-[#1C1917] transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            )}
            <button className="p-2 text-[#78716C] hover:bg-[#F5F5F4] rounded-full transition-colors">
              <Settings2 className="w-5 h-5" />
            </button>
            <button className="p-2 text-[#78716C] hover:bg-[#F5F5F4] rounded-full transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 md:p-10">
        {!isStarted ? (
          <div className="max-w-2xl mx-auto space-y-10 py-12">
            <div className="space-y-4 text-center">
              <h2 className="text-4xl font-bold tracking-tight text-[#1C1917]">Create Your Tournament</h2>
              <p className="text-[#78716C] text-lg">Add participants and generate a professional double-elimination bracket.</p>
            </div>

            <div className="bg-white rounded-2xl border border-[#E7E5E4] p-8 shadow-sm space-y-8">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#78716C] uppercase tracking-wider">Tournament Name</label>
                <input 
                  type="text" 
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  className="w-full text-2xl font-semibold bg-transparent border-b-2 border-[#E7E5E4] focus:border-[#1C1917] outline-none py-2 transition-colors"
                  placeholder="Enter name..."
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[#78716C] uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Participants ({participants.length})
                  </label>
                </div>
                
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
                    placeholder="Add participant name..."
                    className="flex-1 bg-[#F5F5F4] border border-[#E7E5E4] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#1C1917]/10 transition-all"
                  />
                  <button 
                    onClick={addParticipant}
                    className="bg-[#1C1917] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#292524] transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  <AnimatePresence mode="popLayout">
                    {participants.map((p) => (
                      <motion.div 
                        key={p.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center justify-between bg-[#F5F5F4] border border-[#E7E5E4] px-4 py-3 rounded-xl group"
                      >
                        <span className="font-medium truncate">{p.name}</span>
                        <button 
                          onClick={() => removeParticipant(p.id)}
                          className="text-[#A8A29E] hover:text-[#EF4444] transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={startTournament}
                  disabled={participants.length < 2}
                  className="w-full bg-[#1C1917] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#292524] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-lg shadow-[#1C1917]/20"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Generate Bracket
                </button>
                <p className="text-center text-xs text-[#A8A29E] mt-4 uppercase tracking-widest">Minimum 2 participants required</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-16">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">{tournamentName}</h2>
                <p className="text-[#78716C] flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {participants.length} Participants • Double Elimination
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E7E5E4] rounded-xl text-sm font-semibold hover:bg-[#F5F5F4] transition-colors">
                  <Download className="w-4 h-4" />
                  Export PDF
                </button>
              </div>
            </div>

            {/* Winners Bracket */}
            {renderBracket(winnersRounds, "Winners Bracket")}

            {/* Losers Bracket */}
            {losersRounds.length > 0 && renderBracket(losersRounds, "Losers Bracket")}

            {/* Grand Finals */}
            {grandFinalsMatch && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-bold tracking-tight text-[#1C1917]">Grand Finals</h3>
                  <div className="h-[1px] flex-1 bg-[#E7E5E4]" />
                </div>
                <div className="flex justify-center p-8">
                  <div className="relative group w-full max-w-[400px]">
                    <div className="bg-white border-2 border-[#1C1917] rounded-2xl overflow-hidden shadow-xl w-full">
                      <div className="bg-[#1C1917] text-white px-4 py-2 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest">Championship Match</span>
                      </div>
                      <div className="flex items-center">
                        <button 
                          onClick={() => grandFinalsMatch.participant1Id && selectWinner(grandFinalsMatch.id, grandFinalsMatch.participant1Id)}
                          disabled={!grandFinalsMatch.participant1Id}
                          className={`flex-1 flex items-center justify-between px-6 py-5 text-left transition-colors ${
                            grandFinalsMatch.winnerId === grandFinalsMatch.participant1Id ? 'bg-[#1C1917] text-white' : 
                            grandFinalsMatch.winnerId && grandFinalsMatch.winnerId !== grandFinalsMatch.participant1Id ? 'opacity-40' : 
                            'hover:bg-[#F5F5F4]'
                          }`}
                        >
                          <span className="text-lg font-bold truncate mr-2">{getParticipantName(grandFinalsMatch.participant1Id)}</span>
                          {grandFinalsMatch.winnerId === grandFinalsMatch.participant1Id && <Trophy className="w-6 h-6 flex-shrink-0 text-yellow-500" />}
                        </button>
                        <input 
                          type="text"
                          value={grandFinalsMatch.score1 || ''}
                          onChange={(e) => updateScore(grandFinalsMatch.id, 1, e.target.value)}
                          placeholder="0"
                          className={`w-16 h-full py-5 text-center font-mono text-xl border-l border-[#E7E5E4] outline-none focus:bg-[#F5F5F4] transition-colors ${
                            grandFinalsMatch.winnerId === grandFinalsMatch.participant1Id ? 'bg-[#292524] text-white border-[#44403C]' : 'bg-white'
                          }`}
                        />
                      </div>
                      
                      <div className="h-[1px] bg-[#E7E5E4]" />
                      
                      <div className="flex items-center">
                        <button 
                          onClick={() => grandFinalsMatch.participant2Id && selectWinner(grandFinalsMatch.id, grandFinalsMatch.participant2Id)}
                          disabled={!grandFinalsMatch.participant2Id}
                          className={`flex-1 flex items-center justify-between px-6 py-5 text-left transition-colors ${
                            grandFinalsMatch.winnerId === grandFinalsMatch.participant2Id ? 'bg-[#1C1917] text-white' : 
                            grandFinalsMatch.winnerId && grandFinalsMatch.winnerId !== grandFinalsMatch.participant2Id ? 'opacity-40' : 
                            'hover:bg-[#F5F5F4]'
                          }`}
                        >
                          <span className="text-lg font-bold truncate mr-2">{getParticipantName(grandFinalsMatch.participant2Id)}</span>
                          {grandFinalsMatch.winnerId === grandFinalsMatch.participant2Id && <Trophy className="w-6 h-6 flex-shrink-0 text-yellow-500" />}
                        </button>
                        <input 
                          type="text"
                          value={grandFinalsMatch.score2 || ''}
                          onChange={(e) => updateScore(grandFinalsMatch.id, 2, e.target.value)}
                          placeholder="0"
                          className={`w-16 h-full py-5 text-center font-mono text-xl border-l border-[#E7E5E4] outline-none focus:bg-[#F5F5F4] transition-colors ${
                            grandFinalsMatch.winnerId === grandFinalsMatch.participant2Id ? 'bg-[#292524] text-white border-[#44403C]' : 'bg-white'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Winner Display */}
            {grandFinalsMatch?.winnerId && (
              <div className="flex flex-col justify-center items-center gap-6 py-12">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-[#1C1917] text-white p-12 rounded-3xl shadow-2xl shadow-[#1C1917]/40 flex flex-col items-center gap-6 text-center border-8 border-yellow-500/20 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
                  <div className="w-24 h-24 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/40 animate-bounce">
                    <Trophy className="w-12 h-12 text-[#1C1917]" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-4xl font-black uppercase tracking-tighter">
                      {getParticipantName(grandFinalsMatch.winnerId)}
                    </h3>
                    <p className="text-yellow-500 font-bold text-lg tracking-[0.3em] uppercase">Grand Champion</p>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #D6D3D1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #A8A29E;
        }
      `}</style>
    </div>
  );
}
