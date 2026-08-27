'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CAMPAIGNS, CampaignId } from '@/config/campaigns';
import Papa from 'papaparse';

// Types
interface Guest {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  is_attending: boolean;
  has_responded: boolean;
  dietary_notes?: string;
}

interface CampaignLog {
  campaign_id: string;
  channel: string;
  status: string;
}

interface Party {
  id: string;
  party_name: string;
  status: string;
  emails: string[];
  phones: string[];
  admin_notes?: string;
  updated_at?: string;
  family_side?: 'bride' | 'groom' | null;
  has_responded: boolean;
  guests: Guest[];
  campaign_logs: CampaignLog[];
}

interface DashboardStats {
  totalParties: number;
  totalGuests: number;
  confirmedAttending: number;
  confirmedRSVPs: number;
  campaignSentCount: number;
}

// Extended guest type for editing (includes optional id for new guests)
interface EditableGuest {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
}

interface CsvRow {
  'Party Name': string;
  'Email'?: string;
  'Phone'?: string;
  'Guest Name': string;
  'Family Side'?: string;
}

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// Registry Item Types
interface RegistryItem {
  id: number;
  created_at: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  store: string;
  image_url?: string;
  product_url?: string;
  is_purchased: boolean;
  is_favorite: boolean;
}

interface Vendor {
  id: string;
  category: string;
  name: string;
  phone?: string;
  email?: string;
}

type ActiveTab = 'guests' | 'registry' | 'vendors';

// Category and Store options
const CATEGORIES = [
  'Kitchen',
  'Dining',
  'Bed & Bath',
  'Home Decor',
  'Electronics',
  'Honeymoon',
  'Experiences',
  'Cash Fund',
  'Charity',
];

const STORES = [
  'Amazon',
  'Zola',
  'Crate & Barrel',
  'Williams Sonoma',
  'Target',
  'Anthropologie',
  'Cash Fund',
  'Other',
];

// Wedding Date: September 4, 2026 at 12:00 PM
const WEDDING_DATE = new Date('2026-09-04T12:00:00');

function useCountdown(targetDate: Date): CountdownTime {
  const [timeLeft, setTimeLeft] = useState<CountdownTime>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const target = targetDate.getTime();
      const difference = target - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

// Helper: Check if phone is US-based (+1)
function isUSPhone(phone: string | undefined): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/\s/g, '');
  return cleaned.startsWith('+1') || (cleaned.startsWith('1') && cleaned.length === 11);
}

export default function AdminDashboard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const countdown = useCountdown(WEDDING_DATE);

  // 1. Initial State
  const [activeTab, setActiveTab] = useState<ActiveTab>('guests');
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null); // format: `${partyId}-email` or `${partyId}-sms`
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedPartyId, setExpandedPartyId] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignId>('save-the-date');
  const [familySideFilter, setFamilySideFilter] = useState<'all' | 'bride' | 'groom' | 'unassigned'>('all');
  const [rsvpStatusFilter, setRsvpStatusFilter] = useState<'all' | 'pending' | 'attending' | 'partial' | 'declined'>('all');

  // 2. Memoized filtered parties list (Safe from TDZ)
  const filteredParties = useMemo(() => {
    return parties.filter(p => {
      // Family Side Filter
      const sideMatch = familySideFilter === 'all' ? true :
                       familySideFilter === 'unassigned' ? !p.family_side :
                       p.family_side === familySideFilter;

      if (!sideMatch) return false;

      // RSVP Status Filter
      const statusMatch = rsvpStatusFilter === 'all' ? true : getRSVPStatus(p).toLowerCase() === rsvpStatusFilter;
      if (!statusMatch) return false;

      // Search Query Filter (Party name or Guest names)
      if (!adminSearchQuery.trim()) return true;

      const query = adminSearchQuery.toLowerCase().trim();
      const partyNameMatch = p.party_name.toLowerCase().includes(query);
      const guestNamesMatch = p.guests.some(g => g.name?.toLowerCase().includes(query));

      return partyNameMatch || guestNamesMatch;
    });
  }, [parties, familySideFilter, rsvpStatusFilter, adminSearchQuery]);

  // Accepted-guest counts by family side, and the list of fully-declined
  // parties (getRSVPStatus === 'Declined': responded, zero guests attending).
  const rsvpBreakdown = useMemo(() => {
    let brideAccepted = 0;
    let groomAccepted = 0;
    const declinedParties: Party[] = [];

    parties.forEach(party => {
      const attendingGuests = party.guests.filter(g => g.is_attending).length;
      if (party.family_side === 'bride') brideAccepted += attendingGuests;
      else if (party.family_side === 'groom') groomAccepted += attendingGuests;

      if (getRSVPStatus(party) === 'Declined') declinedParties.push(party);
    });

    return { brideAccepted, groomAccepted, declinedParties };
  }, [parties]);

  const [stats, setStats] = useState<DashboardStats>({
    totalParties: 0,
    totalGuests: 0,
    confirmedAttending: 0,
    confirmedRSVPs: 0,
    campaignSentCount: 0,
  });

  // Declined-list Modal State
  const [showDeclinedModal, setShowDeclinedModal] = useState(false);

  // Modal State (Add/Edit Party)
  const [showModal, setShowModal] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [partyName, setPartyName] = useState('');
  const [partyEmails, setPartyEmails] = useState<string[]>(['']);
  const [partyPhones, setPartyPhones] = useState<string[]>(['']);
  const [guests, setGuests] = useState<EditableGuest[]>([{ name: '', email: '' }]);
  const [saving, setSaving] = useState(false);
  const [partyFamilySide, setPartyFamilySide] = useState<'bride' | 'groom' | ''>('');

  // CSV Upload State
  const [uploading, setUploading] = useState(false);

  // Registry State
  const [registryItems, setRegistryItems] = useState<RegistryItem[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);

  // Registry Modal State
  const [showRegistryModal, setShowRegistryModal] = useState(false);
  const [editingItem, setEditingItem] = useState<RegistryItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState('Kitchen');
  const [itemStore, setItemStore] = useState('Amazon');
  const [itemProductUrl, setItemProductUrl] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [itemIsFavorite, setItemIsFavorite] = useState(false);
  const [savingItem, setSavingItem] = useState(false);

  // Vendor State
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [deletingVendorId, setDeletingVendorId] = useState<string | null>(null);
  const [sendingVendorId, setSendingVendorId] = useState<string | null>(null); // format: `${vendorId}-email` or `${vendorId}-sms`

  // Vendor Modal State
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorCategory, setVendorCategory] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [savingVendor, setSavingVendor] = useState(false);

  // ============================================
  // HOISTED HANDLERS (function declarations)
  // ============================================

  async function fetchParties() {
    const { data, error } = await supabase
      .from('parties')
      .select(`
        *,
        guests (id, name, email, phone, is_attending, has_responded, dietary_notes),
        campaign_logs (campaign_id, channel, status)
      `)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching data:', error);
      return;
    }

    if (data) {
      const allParties = data as Party[];
      let guestCount = 0;
      let attendingCount = 0;
      let rsvpCount = 0;
      let sentCount = 0;

      allParties.forEach(party => {
        if (party.guests) {
          guestCount += party.guests.length;
          attendingCount += party.guests.filter(g => g.is_attending).length;
        }

        if (party.has_responded) {
          rsvpCount++;
        }

        const isSent = party.campaign_logs?.some(
          l => l.campaign_id === selectedCampaign && l.status === 'sent'
        );
        if (isSent) sentCount++;
      });

      setStats({
        totalParties: allParties.length,
        totalGuests: guestCount,
        confirmedAttending: attendingCount,
        confirmedRSVPs: rsvpCount,
        campaignSentCount: sentCount,
      });

      setParties(allParties);
    }
  }

  async function fetchRegistryItems() {
    setRegistryLoading(true);
    const { data, error } = await supabase
      .from('registry_items')
      .select('*')
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching registry items:', error);
    } else if (data) {
      setRegistryItems(data as RegistryItem[]);
    }
    setRegistryLoading(false);
  }

  async function fetchVendors() {
    setVendorsLoading(true);
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      console.error('Error fetching vendors:', error);
    } else if (data) {
      setVendors(data as Vendor[]);
    }
    setVendorsLoading(false);
  }

  function openAddVendorModal() {
    setEditingVendor(null);
    setVendorCategory('');
    setVendorName('');
    setVendorPhone('');
    setVendorEmail('');
    setShowVendorModal(true);
  }

  function openEditVendorModal(vendor: Vendor) {
    setEditingVendor(vendor);
    setVendorCategory(vendor.category);
    setVendorName(vendor.name);
    setVendorPhone(vendor.phone || '');
    setVendorEmail(vendor.email || '');
    setShowVendorModal(true);
  }

  function closeVendorModal() {
    setShowVendorModal(false);
    setEditingVendor(null);
    setVendorCategory('');
    setVendorName('');
    setVendorPhone('');
    setVendorEmail('');
  }

  async function handleSaveVendor() {
    if (!vendorCategory.trim() || !vendorName.trim()) {
      alert('Category and name are required');
      return;
    }

    setSavingVendor(true);
    try {
      const payload = {
        category: vendorCategory.trim(),
        name: vendorName.trim(),
        phone: vendorPhone.trim() || null,
        email: vendorEmail.trim() || null,
      };

      if (editingVendor) {
        const { error } = await supabase.from('vendors').update(payload).eq('id', editingVendor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vendors').insert(payload);
        if (error) throw error;
      }

      closeVendorModal();
      await fetchVendors();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to save vendor');
    } finally {
      setSavingVendor(false);
    }
  }

  async function handleDeleteVendor(vendorId: string) {
    const vendor = vendors.find(v => v.id === vendorId);
    const confirmed = window.confirm(`Delete vendor "${vendor?.name || ''}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingVendorId(vendorId);
    const { error } = await supabase.from('vendors').delete().eq('id', vendorId);
    if (error) {
      console.error(error);
      alert('Failed to delete vendor');
    } else {
      await fetchVendors();
    }
    setDeletingVendorId(null);
  }

  async function handleSendVendorWelcome(vendorId: string, channel: 'email' | 'sms') {
    setSendingVendorId(`${vendorId}-${channel}`);
    try {
      const res = await fetch('/api/notify-vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId, channel }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Send failed');
      alert(`Vendor welcome ${channel === 'email' ? 'email' : 'SMS'} sent.`);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSendingVendorId(null);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/admin/login');
  }

  async function handleResendRsvpSms(partyId: string) {
    const party = parties.find(p => p.id === partyId);
    const confirmed = window.confirm(
      `Resend RSVP confirmation SMS to ${party?.party_name || 'this party'}?`
    );
    if (!confirmed) return;

    setSendingId(`${partyId}-resend-rsvp`);
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partyId, campaignId: 'save-the-date', channel: 'sms' }),
      });
      const result = await res.json();
      if (!res.ok) alert(`Failed: ${result.error}`);
      else await fetchParties();
    } catch (e) {
      console.error(e);
      alert('Error sending RSVP confirmation');
    } finally {
      setSendingId(null);
    }
  }

  async function handleSendNotification(partyId: string, channel: 'email' | 'sms') {
    const party = parties.find(p => p.id === partyId);
    const campaignLabel = CAMPAIGNS.find(c => c.id === selectedCampaign)?.label || selectedCampaign;
    const channelLabel = channel === 'email' ? 'Email' : 'SMS';
    const confirmed = window.confirm(
      `Send "${campaignLabel}" via ${channelLabel} to ${party?.party_name || 'this party'}?`
    );
    if (!confirmed) return;

    setSendingId(`${partyId}-${channel}`);
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partyId, campaignId: selectedCampaign, channel }),
      });

      const result = await res.json();

      if (res.ok) {
        await fetchParties();
      } else {
        alert(`Failed: ${result.error}`);
      }
    } catch (e) {
      console.error(e);
      alert('Error sending notification');
    } finally {
      setSendingId(null);
    }
  }

  async function handleFamilySideChange(party: Party, side: 'bride' | 'groom' | null) {
    // Optimistic update
    setParties(prev => prev.map(p => p.id === party.id ? { ...p, family_side: side } : p));
    const { error } = await supabase
      .from('parties')
      .update({ family_side: side })
      .eq('id', party.id);
    if (error) {
      console.error(error);
      // Revert on failure
      setParties(prev => prev.map(p => p.id === party.id ? { ...p, family_side: party.family_side } : p));
    }
  }

  async function handleResetParty(party: Party) {
    const confirmed = window.confirm(
      `Reset all campaign logs and RSVP status for "${party.party_name}"? This allows you to test sending again.`
    );
    if (!confirmed) return;

    try {
      // 1. Delete campaign logs
      await supabase.from('campaign_logs').delete().eq('party_id', party.id);

      // 2. Reset party status
      await supabase
        .from('parties')
        .update({
          status: 'pending',
          has_responded: false,
          admin_notes: null
        })
        .eq('id', party.id);

      // 3. Reset guest attendance
      await supabase
        .from('guests')
        .update({
          is_attending: false,
          dietary_notes: null
        })
        .eq('party_id', party.id);

      await fetchParties();
      alert('Party has been reset for testing.');
    } catch (err) {
      console.error('Reset error:', err);
      alert('Failed to reset party');
    }
  }

  async function handleDeleteParty(party: Party) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${party.party_name}" and all ${party.guests.length} guest(s)? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(party.id);

    try {
      // First delete campaign_logs for this party
      await supabase.from('campaign_logs').delete().eq('party_id', party.id);

      // Then delete guests
      const { error: guestsError } = await supabase
        .from('guests')
        .delete()
        .eq('party_id', party.id);

      if (guestsError) throw guestsError;

      // Finally delete the party
      const { error: partyError } = await supabase
        .from('parties')
        .delete()
        .eq('id', party.id);

      if (partyError) throw partyError;

      await fetchParties();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete party');
    } finally {
      setDeletingId(null);
    }
  }

  function openAddModal() {
    setEditingParty(null);
    setPartyName('');
    setPartyEmails(['']);
    setPartyPhones(['']);
    setPartyFamilySide('');
    setGuests([{ name: '', email: '', phone: '' }]);
    setShowModal(true);
  }

  function openEditModal(party: Party) {
    setEditingParty(party);
    setPartyName(party.party_name);
    setPartyEmails(party.emails?.length > 0 ? party.emails : ['']);
    setPartyPhones(party.phones?.length > 0 ? party.phones : ['']);
    setPartyFamilySide(party.family_side || '');
    setGuests(
      party.guests.length > 0
        ? party.guests.map(g => ({ id: g.id, name: g.name || '', email: g.email || '', phone: g.phone || '' }))
        : [{ name: '', email: '', phone: '' }]
    );
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingParty(null);
    setPartyName('');
    setPartyEmails(['']);
    setPartyPhones(['']);
    setPartyFamilySide('');
    setGuests([{ name: '', email: '', phone: '' }]);
  }

  function handleAddGuest() {
    setGuests([...guests, { name: '', email: '', phone: '' }]);
  }

  function handleRemoveGuest(index: number) {
    if (guests.length > 1) {
      setGuests(guests.filter((_, i) => i !== index));
    }
  }

  function handleGuestChange(index: number, field: 'name' | 'email' | 'phone', value: string) {
    const updated = [...guests];
    updated[index][field] = value;
    setGuests(updated);
  }

  async function handleSaveParty() {
    if (!partyName.trim()) {
      alert('Party name is required');
      return;
    }

    const validGuests = guests.filter(g => g.name.trim());
    if (validGuests.length === 0) {
      alert('At least one guest name is required');
      return;
    }

    setSaving(true);

    try {
      if (editingParty) {
        // ========== UPDATE MODE ==========
        const oldEmails = editingParty.emails || [];
        const oldPhones = editingParty.phones || [];
        const newEmails = partyEmails.map(e => e.trim()).filter(Boolean);
        const newPhones = partyPhones.map(p => p.trim()).filter(Boolean);

        const emailsChanged = newEmails.some(e => !oldEmails.includes(e)) || oldEmails.some(e => !newEmails.includes(e));
        const phonesChanged = newPhones.some(p => !oldPhones.includes(p)) || oldPhones.some(p => !newPhones.includes(p));

        const campaignsToResend = new Set<string>();

        if (emailsChanged && newEmails.length > 0) {
          const sentEmailLogs = editingParty.campaign_logs?.filter(
            l => l.channel === 'email' && l.status === 'sent'
          ) || [];
          sentEmailLogs.forEach(l => campaignsToResend.add(l.campaign_id));

          await supabase
            .from('campaign_logs')
            .delete()
            .eq('party_id', editingParty.id)
            .eq('channel', 'email');
        }

        if (phonesChanged && newPhones.length > 0) {
          const sentSmsLogs = editingParty.campaign_logs?.filter(
            l => l.channel === 'sms' && l.status === 'sent'
          ) || [];
          sentSmsLogs.forEach(l => campaignsToResend.add(l.campaign_id));

          await supabase
            .from('campaign_logs')
            .delete()
            .eq('party_id', editingParty.id)
            .eq('channel', 'sms');
        }

        const { error: partyError } = await supabase
          .from('parties')
          .update({
            party_name: partyName.trim(),
            emails: newEmails,
            phones: newPhones,
            family_side: partyFamilySide || null,
          })
          .eq('id', editingParty.id);

        if (partyError) throw partyError;

        const existingGuestIds = editingParty.guests.map(g => g.id);
        const currentGuestIds = validGuests.filter(g => g.id).map(g => g.id!);

        const guestsToDelete = existingGuestIds.filter(id => !currentGuestIds.includes(id));
        if (guestsToDelete.length > 0) {
          await supabase.from('guests').delete().in('id', guestsToDelete);
        }

        for (const guest of validGuests.filter(g => g.id)) {
          const sanitizedEmail = guest.email?.trim() && guest.email.trim() !== '---'
            ? guest.email.trim().toLowerCase()
            : null;
          const sanitizedPhone = guest.phone?.trim() || null;
          await supabase
            .from('guests')
            .update({
              name: guest.name.trim(),
              email: sanitizedEmail,
              phone: sanitizedPhone
            })
            .eq('id', guest.id!);
        }

        const newGuests = validGuests.filter(g => !g.id);
        if (newGuests.length > 0) {
          await supabase.from('guests').insert(
            newGuests.map(g => {
              const sanitizedEmail = g.email?.trim() && g.email.trim() !== '---'
                ? g.email.trim().toLowerCase()
                : null;
              return {
                party_id: editingParty.id,
                name: g.name.trim(),
                email: sanitizedEmail,
                phone: g.phone?.trim() || null,
                is_attending: false,
              };
            })
          );
        }

        if (campaignsToResend.size > 0) {
          const resendResults: string[] = [];
          for (const campaignId of Array.from(campaignsToResend)) {
            try {
              const res = await fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partyId: editingParty.id, campaignId }),
              });
              const result = await res.json();
              if (res.ok) {
                const label = CAMPAIGNS.find(c => c.id === campaignId)?.label || campaignId;
                resendResults.push(`${label}: sent`);
              } else {
                resendResults.push(`${campaignId}: ${result.error || 'failed'}`);
              }
            } catch {
              resendResults.push(`${campaignId}: network error`);
            }
          }
          alert(`Contact info updated. Re-sent ${campaignsToResend.size} campaign(s):\n${resendResults.join('\n')}`);
        }
      } else {
        // ========== CREATE MODE ==========
        const { data: partyData, error: partyError } = await supabase
          .from('parties')
          .insert({
            party_name: partyName.trim(),
            emails: partyEmails.map(e => e.trim()).filter(Boolean),
            phones: partyPhones.map(p => p.trim()).filter(Boolean),
            family_side: partyFamilySide || null,
            status: 'pending',
          })
          .select('id')
          .single();

        if (partyError || !partyData) {
          throw new Error(partyError?.message || 'Failed to create party');
        }

        const guestInserts = validGuests.map(g => {
          const sanitizedEmail = g.email?.trim() && g.email.trim() !== '---'
            ? g.email.trim().toLowerCase()
            : null;
          return {
            party_id: partyData.id,
            name: g.name.trim(),
            email: sanitizedEmail,
            phone: g.phone?.trim() || null,
            is_attending: false,
          };
        });

        const { error: guestsError } = await supabase.from('guests').insert(guestInserts);
        if (guestsError) throw guestsError;
      }

      closeModal();
      await fetchParties();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to save party');
    } finally {
      setSaving(false);
    }
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data;
          if (rows.length === 0) {
            alert('CSV is empty');
            return;
          }

          const partyMap = new Map<string, { party_name: string; emails: string[]; phones: string[]; guests: { name: string; email: string | null }[]; family_side: 'bride' | 'groom' | null }>();
          const skippedRows: { row: number; guest: string; reason: string }[] = [];

          rows.forEach((row, index) => {
            const rowNumber = index + 2;
            const keys = Object.keys(row);
            
            // The unique grouping key from CSV (Party ID)
            const idKey = keys.find(k => k.toLowerCase() === 'party id') || 
                          keys.find(k => k.toLowerCase().includes('party') && k.toLowerCase().includes('id')) ||
                          'Party ID';
            
            // The display name (Party Name)
            const nameKey = keys.find(k => k.toLowerCase() === 'party name') || 
                            keys.find(k => k.toLowerCase().includes('party') && !k.toLowerCase().includes('id')) ||
                            'Party Name';

            const emailKey = keys.find(k => k.toLowerCase().includes('email')) || 'Email';
            const phoneKey = keys.find(k => k.toLowerCase().includes('phone')) || 'Phone';
            const guestKey = keys.find(k => k.toLowerCase().includes('guest')) || 'Guest Name';
            const sideKey = keys.find(k => k.toLowerCase().includes('family') || k.toLowerCase().includes('side')) || 'Family Side';

            const rowData = row as unknown as Record<string, string>;
            const csvPartyId = rowData[idKey]?.trim();
            const csvPartyName = rowData[nameKey]?.trim();
            const guestName = rowData[guestKey]?.trim();
            const rawEmail = rowData[emailKey]?.trim();
            const rawPhone = rowData[phoneKey]?.trim();
            const rawSide = rowData[sideKey]?.trim().toLowerCase();
            const familySide: 'bride' | 'groom' | null =
              rawSide === 'bride' ? 'bride' : rawSide === 'groom' ? 'groom' : null;

            if (!csvPartyId || !guestName) {
              skippedRows.push({ row: rowNumber, guest: guestName || 'Unknown', reason: 'Missing Party ID or Guest Name' });
              return;
            }

            // Email Sanitization
            const sanitizeEmail = (e: string | undefined) => {
              if (!e || e === '---' || !e.includes('@')) return null;
              return e.toLowerCase();
            };
            const guestEmail = sanitizeEmail(rawEmail);

            // Phone Sanitization
            const formatPhoneNumber = (p: string | undefined) => {
              if (!p || p === '---') return null;
              const digits = p.replace(/\D/g, '');
              if (digits.length === 10) return `+1${digits}`;
              if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
              if (p.startsWith('+1') && p.replace(/\D/g, '').length === 11) return `+${p.replace(/\D/g, '')}`;
              return null;
            };
            const sanitizedPhone = formatPhoneNumber(rawPhone);

            if (!partyMap.has(csvPartyId)) {
              partyMap.set(csvPartyId, { 
                party_name: csvPartyName || csvPartyId,
                emails: [], 
                phones: [], 
                guests: [], 
                family_side: familySide 
              });
            }

            const entry = partyMap.get(csvPartyId)!;
            if (guestEmail && !entry.emails.includes(guestEmail)) entry.emails.push(guestEmail);
            if (sanitizedPhone && !entry.phones.includes(sanitizedPhone)) entry.phones.push(sanitizedPhone);
            if (!entry.family_side && familySide) entry.family_side = familySide;
            
            entry.guests.push({ name: guestName, email: guestEmail });
          });

          let upsertedParties = 0;
          let newGuestsInserted = 0;

          for (const [csvPartyId, partyInfo] of Array.from(partyMap.entries())) {
            // Upsert Party based on external_id (the CSV's Party ID)
            const { data: partyData, error: partyError } = await supabase
              .from('parties')
              .upsert({
                external_id: csvPartyId,
                party_name: partyInfo.party_name,
                emails: partyInfo.emails,
                phones: partyInfo.phones,
                family_side: partyInfo.family_side,
                status: 'pending',
              }, { onConflict: 'external_id' })
              .select('id')
              .single();

            if (partyError || !partyData) {
              console.error(`Failed to upsert party ID ${csvPartyId}:`, partyError);
              continue;
            }

            upsertedParties++;

            // Fetch existing guests for this party to prevent duplicates
            const { data: existingGuests } = await supabase
              .from('guests')
              .select('name')
              .eq('party_id', partyData.id);

            const existingNames = new Set(existingGuests?.map(g => g.name.toLowerCase()) || []);

            const guestInserts = partyInfo.guests
              .filter(g => !existingNames.has(g.name.toLowerCase()))
              .map(g => ({
                party_id: partyData.id,
                name: g.name,
                email: g.email,
                is_attending: false,
              }));

            if (guestInserts.length > 0) {
              const { error: guestsError } = await supabase.from('guests').insert(guestInserts);
              if (guestsError) {
                console.error(`Failed to insert guests for party ${csvPartyId}:`, guestsError);
              } else {
                newGuestsInserted += guestInserts.length;
              }
            }
          }

          let summary = `Import processed: ${upsertedParties} parties updated/created, ${newGuestsInserted} new guests added.`;
          if (skippedRows.length > 0) {
            summary += `\n\nWARNING: Skipped ${skippedRows.length} rows due to missing data:\n` + 
              skippedRows.map(s => `Row ${s.row} (${s.guest})`).join(', ');
          }
          alert(summary);
          await fetchParties();
        } catch (err) {
          console.error('CSV processing error:', err);
          alert('Failed to process CSV');
        } finally {
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (err) => {
        console.error('CSV parse error:', err);
        alert('Failed to parse CSV');
        setUploading(false);
      },
    });
  }

  function getChannelStatus(party: Party, channel: 'email' | 'sms') {
    return party.campaign_logs?.some(
      l => l.campaign_id === selectedCampaign && l.channel === channel && l.status === 'sent'
    );
  }

  function getRSVPStatus(party: Party) {
    if (!party.has_responded) return 'Pending';
    // 'Partial' means someone in the party still hasn't individually
    // answered yet (e.g. added after the family's original RSVP) — not
    // simply "not everyone is attending". Once everyone has answered,
    // the party is resolved either way: Declined (nobody coming) or
    // Attending (at least one is), even if attendance is a mix.
    const unanswered = party.guests.some(g => !g.has_responded);
    if (unanswered) return 'Partial';
    const attendingCount = party.guests.filter(g => g.is_attending).length;
    if (attendingCount === 0) return 'Declined';
    return 'Attending';
  }

  function getRSVPStatusColor(status: string) {
    switch (status) {
      case 'Attending': return 'bg-green-100 text-green-700';
      case 'Declined': return 'bg-red-100 text-red-600';
      case 'Partial': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  }

  function openAddItemModal() {
    setEditingItem(null);
    setItemName('');
    setItemPrice('');
    setItemCategory('Kitchen');
    setItemStore('Amazon');
    setItemProductUrl('');
    setItemImageUrl('');
    setItemIsFavorite(false);
    setShowRegistryModal(true);
  }

  function openEditItemModal(item: RegistryItem) {
    setEditingItem(item);
    setItemName(item.name);
    setItemPrice(item.price.toString());
    setItemCategory(item.category);
    setItemStore(item.store);
    setItemProductUrl(item.product_url || '');
    setItemImageUrl(item.image_url || '');
    setItemIsFavorite(item.is_favorite);
    setShowRegistryModal(true);
  }

  function closeRegistryModal() {
    setShowRegistryModal(false);
    setEditingItem(null);
    setItemName('');
    setItemPrice('');
    setItemCategory('Kitchen');
    setItemStore('Amazon');
    setItemProductUrl('');
    setItemImageUrl('');
    setItemIsFavorite(false);
  }

  async function handleSaveItem() {
    if (!itemName.trim()) {
      alert('Item name is required');
      return;
    }

    const price = parseFloat(itemPrice);
    if (isNaN(price) || price < 0) {
      alert('Please enter a valid price');
      return;
    }

    setSavingItem(true);

    try {
      const itemData = {
        name: itemName.trim(),
        price,
        category: itemCategory,
        store: itemStore,
        product_url: itemProductUrl.trim() || null,
        image_url: itemImageUrl.trim() || null,
        is_favorite: itemIsFavorite,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('registry_items')
          .update(itemData)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('registry_items')
          .insert(itemData);
        if (error) throw error;
      }

      closeRegistryModal();
      await fetchRegistryItems();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSavingItem(false);
    }
  }

  async function handleDeleteItem(item: RegistryItem) {
    const confirmed = window.confirm(`Delete "${item.name}" from registry?`);
    if (!confirmed) return;

    setDeletingItemId(item.id);
    try {
      const { error } = await supabase
        .from('registry_items')
        .delete()
        .eq('id', item.id);
      if (error) throw error;
      await fetchRegistryItems();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Error deleting item');
    } finally {
      setDeletingItemId(null);
    }
  }

  async function handleTogglePurchased(item: RegistryItem) {
    try {
      // Toggling back to unpurchased must clear any buyer info too — otherwise
      // the item shows as available again while still carrying a stale name/
      // email/phone from the previous purchase.
      const nextPurchased = !item.is_purchased;
      const { error } = await supabase
        .from('registry_items')
        .update(
          nextPurchased
            ? { is_purchased: true }
            : { is_purchased: false, purchaser_name: null, purchaser_email: null, purchaser_phone: null, purchaser_message: null }
        )
        .eq('id', item.id);

      if (error) throw error;
      await fetchRegistryItems();
    } catch (err) {
      console.error('Toggle error:', err);
      alert('Failed to update item');
    }
  }

  useEffect(() => {
    if (!loading) {
      fetchParties();
      fetchRegistryItems();
    }
  }, [selectedCampaign, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'registry') {
      fetchRegistryItems();
    } else if (activeTab === 'vendors') {
      fetchVendors();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/admin/login');
        return;
      }
      await fetchParties();
      await fetchRegistryItems();
      setLoading(false);
    };

    checkAuthAndFetch();
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F7F2] flex items-center justify-center">
        <p className="font-serif text-[#1B3B28] animate-pulse">Loading Dashboard...</p>
      </div>
    );
  }

  const currentCampaignLabel = CAMPAIGNS.find(c => c.id === selectedCampaign)?.label;

  return (
    <div className="min-h-screen bg-[#F9F7F2] text-[#1B3B28] p-6 md:p-12">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-[#D4A845] mb-2">Campaign Manager</h1>
            <p className="text-xs uppercase tracking-widest text-gray-500">
              Current Focus: <span className="font-bold text-[#1B3B28]">{currentCampaignLabel}</span>
            </p>
          </div>

          {/* Countdown Timer */}
          <div className="flex items-center gap-1 text-center">
            <div className="px-3 py-2">
              <p className="font-serif text-2xl md:text-3xl text-[#1B3B28]">{countdown.days}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Days</p>
            </div>
            <span className="font-serif text-xl text-[#D4A845]">:</span>
            <div className="px-3 py-2">
              <p className="font-serif text-2xl md:text-3xl text-[#1B3B28]">{String(countdown.hours).padStart(2, '0')}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Hrs</p>
            </div>
            <span className="font-serif text-xl text-[#D4A845]">:</span>
            <div className="px-3 py-2">
              <p className="font-serif text-2xl md:text-3xl text-[#1B3B28]">{String(countdown.minutes).padStart(2, '0')}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Min</p>
            </div>
            <span className="font-serif text-xl text-[#D4A845]">:</span>
            <div className="px-3 py-2">
              <p className="font-serif text-2xl md:text-3xl text-[#1B3B28]">{String(countdown.seconds).padStart(2, '0')}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Sec</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value as CampaignId)}
            className="px-4 py-2 border border-[#D4A845] rounded bg-white text-[#1B3B28] text-sm focus:outline-none"
          >
            {CAMPAIGNS.map(c => (
              <option key={c.id} value={c.id}>
                {c.label} {c.disabled ? '(Locked)' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={handleLogout}
            className="px-6 py-2 border border-[#1B3B28]/20 rounded hover:bg-[#1B3B28] hover:text-white transition-colors text-sm uppercase tracking-widest"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded shadow-sm border-t-4 border-[#D4A845]">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Total Parties</p>
            <p className="font-serif text-3xl md:text-4xl">{stats.totalParties}</p>
          </div>
          <div className="bg-white p-6 rounded shadow-sm border-t-4 border-purple-500">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">RSVPs (Parties)</p>
            <p className="font-serif text-3xl md:text-4xl">
              {stats.confirmedRSVPs} <span className="text-base text-gray-400">/ {stats.totalParties}</span>
            </p>
          </div>
          <div className="bg-white p-6 rounded shadow-sm border-t-4 border-[#1B3B28]">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Total Guests</p>
            <p className="font-serif text-3xl md:text-4xl">{stats.totalGuests}</p>
          </div>
          <div className="bg-white p-6 rounded shadow-sm border-t-4 border-green-600">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Attending</p>
            <p className="font-serif text-3xl md:text-4xl">{stats.confirmedAttending}</p>
          </div>
          <div className="bg-white p-6 rounded shadow-sm border-t-4 border-blue-500">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">
              {currentCampaignLabel} Sent
            </p>
            <p className="font-serif text-3xl md:text-4xl">
              {stats.campaignSentCount} <span className="text-base text-gray-400">/ {stats.totalParties}</span>
            </p>
          </div>
          <div className="bg-white p-6 rounded shadow-sm border-t-4 border-pink-500">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Accepted (Bride&apos;s Side)</p>
            <p className="font-serif text-3xl md:text-4xl">{rsvpBreakdown.brideAccepted}</p>
          </div>
          <div className="bg-white p-6 rounded shadow-sm border-t-4 border-blue-600">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Accepted (Groom&apos;s Side)</p>
            <p className="font-serif text-3xl md:text-4xl">{rsvpBreakdown.groomAccepted}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeclinedModal(true)}
            className="bg-white p-6 rounded shadow-sm border-t-4 border-red-500 text-left hover:shadow-md transition-shadow"
          >
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Declined (View List)</p>
            <p className="font-serif text-3xl md:text-4xl">{rsvpBreakdown.declinedParties.length}</p>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded shadow-sm p-1 mb-4 inline-flex border border-gray-100">
          <button
            onClick={() => setActiveTab('guests')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-widest rounded transition-colors ${
              activeTab === 'guests'
                ? 'bg-[#1B3B28] text-white'
                : 'text-[#1B3B28] hover:bg-gray-100'
            }`}
          >
            Guest List
          </button>
          <button
            onClick={() => setActiveTab('registry')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-widest rounded transition-colors ${
              activeTab === 'registry'
                ? 'bg-[#1B3B28] text-white'
                : 'text-[#1B3B28] hover:bg-gray-100'
            }`}
          >
            Registry
          </button>
          <button
            onClick={() => setActiveTab('vendors')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-widest rounded transition-colors ${
              activeTab === 'vendors'
                ? 'bg-[#1B3B28] text-white'
                : 'text-[#1B3B28] hover:bg-gray-100'
            }`}
          >
            Vendors
          </button>
        </div>

        {/* GUESTS TAB */}
        {activeTab === 'guests' && (
          <>
            {/* Guest Management Toolbar */}
            <div className="bg-white rounded shadow-sm p-4 mb-4 flex flex-wrap items-center gap-4 border border-gray-100">
              <span className="text-xs uppercase tracking-widest text-gray-500 font-bold">Guest Management:</span>

              <button
                onClick={openAddModal}
                className="px-4 py-2 bg-[#1B3B28] text-white text-sm font-bold rounded hover:bg-[#2a5a3f] transition-colors flex items-center gap-2"
              >
                <span className="text-lg leading-none">+</span> Add Party
              </button>

              <label className="px-4 py-2 border border-[#D4A845] text-[#D4A845] text-sm font-bold rounded hover:bg-[#D4A845] hover:text-white transition-colors cursor-pointer flex items-center gap-2">
                {uploading ? 'Uploading...' : 'Upload CSV'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => {
                  const header = 'Party Name,Email,Phone,Guest Name,Family Side';
                  const sample = [
                    'Gebre Family,gebre@example.com,+12025551234,Yohannes Gebre,groom',
                    'Gebre Family,,,Tigist Gebre,groom',
                    'Tadesse Family,tadesse@example.com,+12025555678,Almaz Tadesse,bride',
                    'Tadesse Family,,,Biruk Tadesse,bride',
                    'Bekele Family,bekele@example.com,,Dawit Bekele,',
                  ].join('\n');
                  const blob = new Blob([header + '\n' + sample], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'guest-list-template.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-500 text-sm font-bold rounded hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                ↓ Sample CSV
              </button>

              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                  <input
                    type="text"
                    value={adminSearchQuery}
                    onChange={(e) => setAdminSearchQuery(e.target.value)}
                    placeholder="Search guests or parties..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] text-sm bg-white text-black"
                  />
                </div>
              </div>
            </div>

            {/* Family Side Filter */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {(['all', 'bride', 'groom', 'unassigned'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFamilySideFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
                    familySideFilter === f
                      ? f === 'bride'
                        ? 'bg-pink-500 text-white'
                        : f === 'groom'
                        ? 'bg-blue-600 text-white'
                        : f === 'unassigned'
                        ? 'bg-gray-400 text-white'
                        : 'bg-[#1B3B28] text-white'
                      : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {f === 'bride' ? "Bride's Side" : f === 'groom' ? "Groom's Side" : f === 'unassigned' ? 'Unassigned' : 'All'}
                  {f !== 'all' && (
                    <span className="ml-1 opacity-70">
                      ({f === 'unassigned'
                        ? parties.filter(p => !p.family_side).length
                        : parties.filter(p => p.family_side === f).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* RSVP Status Filter */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {(['all', 'pending', 'attending', 'partial', 'declined'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setRsvpStatusFilter(s)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
                    rsvpStatusFilter === s
                      ? s === 'pending'
                        ? 'bg-gray-500 text-white'
                        : s === 'attending'
                        ? 'bg-green-600 text-white'
                        : s === 'partial'
                        ? 'bg-yellow-500 text-white'
                        : s === 'declined'
                        ? 'bg-red-500 text-white'
                        : 'bg-[#1B3B28] text-white'
                      : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {s === 'pending' ? "Hasn't Responded" : s === 'attending' ? 'Attending' : s === 'partial' ? 'Partial' : s === 'declined' ? 'Declined' : 'All RSVP'}
                  {s !== 'all' && (
                    <span className="ml-1 opacity-70">
                      ({parties.filter(p => getRSVPStatus(p).toLowerCase() === s).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Data Table */}
            <div className="bg-white rounded shadow-sm overflow-hidden border border-gray-100">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#1B3B28] text-white text-xs uppercase tracking-wider">
                    <tr>
                      <th className="p-4 font-medium">Party Name</th>
                      <th className="p-4 font-medium">Guests</th>
                      <th className="p-4 font-medium">RSVP Status</th>
                      <th className="p-4 font-medium">Email</th>
                      <th className="p-4 font-medium">SMS</th>
                      <th className="p-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {filteredParties.map((party) => {
                      const emailSent = getChannelStatus(party, 'email');
                      const smsSent = getChannelStatus(party, 'sms');
                      const hasEmail = party.emails?.length > 0;
                      const hasPhone = party.phones?.length > 0;
                      const hasUSPhone = party.phones?.some(p => isUSPhone(p)) ?? false;
                      const primaryPhone = party.phones?.[0];
                      const activeCampaign = CAMPAIGNS.find(c => c.id === selectedCampaign);
                      const rsvpStatus = getRSVPStatus(party);
                      const isExpanded = expandedPartyId === party.id;

                      return (
                        <React.Fragment key={party.id}>
                          <tr className={`hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-gray-50/80' : ''}`}>
                            <td className="p-4 font-medium text-[#1B3B28]">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => setExpandedPartyId(isExpanded ? null : party.id)}
                                  className="text-gray-400 hover:text-[#D4A845] transition-colors"
                                >
                                  {isExpanded ? '▼' : '▶'}
                                </button>
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center gap-2">
                                    {party.party_name}
                                    {party.party_name.includes('(TEST)') && (
                                      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">TEST</span>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleFamilySideChange(party, 'bride')}
                                      title="Bride's side"
                                      className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded transition-colors ${
                                        party.family_side === 'bride'
                                          ? 'bg-pink-500 text-white'
                                          : 'bg-gray-100 text-gray-400 hover:bg-pink-100 hover:text-pink-600'
                                      }`}
                                    >
                                      B
                                    </button>
                                    <button
                                      onClick={() => handleFamilySideChange(party, 'groom')}
                                      title="Groom's side"
                                      className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded transition-colors ${
                                        party.family_side === 'groom'
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-gray-100 text-gray-400 hover:bg-blue-100 hover:text-blue-600'
                                      }`}
                                    >
                                      G
                                    </button>
                                    {party.family_side && (
                                      <button
                                        onClick={() => handleFamilySideChange(party, null)}
                                        title="Clear assignment"
                                        className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-400 transition-colors"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              {party.guests.length}{' '}
                              <span className="text-gray-400">Guests</span>
                            </td>
                            <td className="p-4">
                              <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${getRSVPStatusColor(rsvpStatus)}`}>
                                {rsvpStatus}
                              </span>
                            </td>
                            {/* Email column: address + send status */}
                            <td className="p-4">
                              {!hasEmail ? (
                                <span className="text-gray-300 text-xs">No email</span>
                              ) : (
                                <div className="flex flex-col gap-1.5">
                                  <span className="text-[11px] text-gray-500 truncate max-w-[180px]" title={party.emails?.join(', ')}>
                                    {party.emails?.[0]}
                                    {(party.emails?.length ?? 0) > 1 && (
                                      <span className="text-gray-400 ml-1">+{party.emails!.length - 1}</span>
                                    )}
                                  </span>
                                  {emailSent ? (
                                    <span className="inline-block w-fit px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-green-100 text-green-700">
                                      ✓ Sent
                                    </span>
                                  ) : activeCampaign?.disabled ? (
                                    <span className="text-xs text-gray-400 italic">Locked</span>
                                  ) : activeCampaign?.priority === 'sms' ? (
                                    <span className="text-gray-300 text-xs">—</span>
                                  ) : (
                                    <button
                                      onClick={() => handleSendNotification(party.id, 'email')}
                                      disabled={sendingId === `${party.id}-email`}
                                      className="w-fit px-3 py-0.5 bg-[#D4A845] text-white text-xs font-bold uppercase rounded hover:bg-[#b88f35] transition-colors disabled:opacity-50"
                                    >
                                      {sendingId === `${party.id}-email` ? 'Sending...' : 'Send Email'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* SMS column: phone + send status */}
                            <td className="p-4">
                              {!hasPhone ? (
                                <span className="text-gray-300 text-xs">No phone</span>
                              ) : !hasUSPhone ? (
                                <div className="flex flex-col gap-1.5">
                                  <span className="text-[11px] text-gray-500 truncate max-w-[160px]" title={primaryPhone}>
                                    {primaryPhone}
                                  </span>
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium w-fit">Intl</span>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1.5">
                                  <span className="text-[11px] text-gray-500 truncate max-w-[160px]" title={party.phones?.join(', ')}>
                                    {primaryPhone}
                                    {(party.phones?.length ?? 0) > 1 && (
                                      <span className="text-gray-400 ml-1">+{party.phones!.length - 1}</span>
                                    )}
                                  </span>
                                  {smsSent ? (
                                    <span className="inline-block w-fit px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-green-100 text-green-700">
                                      ✓ Sent
                                    </span>
                                  ) : activeCampaign?.disabled ? (
                                    <span className="text-xs text-gray-400 italic">Locked</span>
                                  ) : activeCampaign?.priority === 'email' ? (
                                    <span className="text-gray-300 text-xs">—</span>
                                  ) : (
                                    <button
                                      onClick={() => handleSendNotification(party.id, 'sms')}
                                      disabled={sendingId === `${party.id}-sms`}
                                      className="w-fit px-3 py-0.5 bg-[#1B3B28] text-white text-xs font-bold uppercase rounded hover:bg-[#2a5a3f] transition-colors disabled:opacity-50"
                                    >
                                      {sendingId === `${party.id}-sms` ? 'Sending...' : 'Send SMS'}
                                    </button>
                                  )}
                                  {party.has_responded && (
                                    <button
                                      onClick={() => handleResendRsvpSms(party.id)}
                                      disabled={sendingId === `${party.id}-resend-rsvp`}
                                      className="w-fit px-3 py-0.5 bg-blue-700 text-white text-xs font-bold uppercase rounded hover:bg-blue-800 transition-colors disabled:opacity-50"
                                    >
                                      {sendingId === `${party.id}-resend-rsvp` ? 'Sending...' : 'Resend RSVP'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* Reset Button (Test only) */}
                                {party.party_name.includes('(TEST)') && (
                                  <button
                                    onClick={() => handleResetParty(party)}
                                    className="text-gray-400 hover:text-blue-500 transition-colors text-lg"
                                    title="Reset Logs & RSVP"
                                  >
                                    🔄
                                  </button>
                                )}

                                {/* Edit Button */}
                                <button
                                  onClick={() => openEditModal(party)}
                                  className="text-[#D4A845] hover:text-[#b88f35] transition-colors text-lg"
                                  title="Edit Party"
                                >
                                  ✏️
                                </button>

                                {/* Delete Button */}
                                <button
                                  onClick={() => handleDeleteParty(party)}
                                  disabled={deletingId === party.id}
                                  className="text-red-500 hover:text-red-700 transition-colors text-lg disabled:opacity-50"
                                  title="Delete Party"
                                >
                                  {deletingId === party.id ? '...' : '🗑️'}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-white">
                              <td colSpan={6} className="p-6 border-b border-gray-100">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  {/* Guest Attendance */}
                                  <div>
                                    <h4 className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-4">Guest Attendance</h4>
                                    <div className="space-y-3">
                                      {party.guests.map(guest => (
                                        <div key={guest.id} className="flex items-center justify-between p-3 border border-gray-100 rounded">
                                          <div className="flex flex-col">
                                            <span className="font-medium">{guest.name}</span>
                                            {guest.email && (
                                              <span className="text-[10px] text-gray-400 italic">{guest.email}</span>
                                            )}
                                            {guest.phone && (
                                              <span className="text-[10px] text-gray-400 italic">{guest.phone}</span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {!guest.has_responded ? (
                                              <span className="text-gray-400 text-xs font-bold uppercase tracking-wider italic">No Response</span>
                                            ) : guest.is_attending ? (
                                              <span className="text-green-600 text-xs font-bold uppercase tracking-wider">✓ Attending</span>
                                            ) : (
                                              <span className="text-red-500 text-xs font-bold uppercase tracking-wider">× Declined</span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* RSVP Details */}
                                  <div>
                                    <h4 className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-4">Response Details</h4>
                                    {party.has_responded ? (
                                      <div className="space-y-4">
                                        <div className="bg-gray-50 p-4 rounded border border-gray-100">
                                          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Response Received</p>
                                          <p className="text-sm font-medium">
                                            {new Date(party.updated_at!).toLocaleString(undefined, {
                                              dateStyle: 'long',
                                              timeStyle: 'short'
                                            })}
                                          </p>
                                        </div>
                                        {party.admin_notes && (
                                          <div className="bg-gray-50 p-4 rounded border border-gray-100">
                                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Message from Guest</p>
                                            <p className="text-sm italic text-gray-700">&quot;{party.admin_notes.replace('User Message: ', '')}&quot;</p>
                                          </div>
                                        )}
                                        {party.guests.some(g => g.dietary_notes) && (
                                          <div className="bg-red-50 p-4 rounded border border-red-100">
                                            <p className="text-xs text-red-500 uppercase tracking-widest mb-1 font-bold">Dietary Restrictions</p>
                                            <div className="space-y-1">
                                              {party.guests.filter(g => g.dietary_notes).map(g => (
                                                <p key={g.id} className="text-sm">
                                                  <span className="font-bold">{g.name}:</span> {g.dietary_notes}
                                                </p>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="h-full flex items-center justify-center border border-dashed border-gray-200 rounded p-8">
                                        <p className="text-gray-400 text-sm italic">Waiting for party to respond...</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* REGISTRY TAB */}
        {activeTab === 'registry' && (
          <>
            {/* Registry Management Toolbar */}
            <div className="bg-white rounded shadow-sm p-4 mb-8 flex items-center justify-between border border-gray-100">
              <span className="text-xs uppercase tracking-widest text-gray-500 font-bold">Registry Management:</span>
              <button
                onClick={openAddItemModal}
                className="px-4 py-2 bg-[#1B3B28] text-white text-sm font-bold rounded hover:bg-[#2a5a3f] transition-colors flex items-center gap-2"
              >
                <span className="text-lg leading-none">+</span> Add Gift
              </button>
            </div>

            {registryLoading ? (
              <div className="py-20 text-center">
                <p className="font-serif text-[#1B3B28] animate-pulse italic">Loading registry items...</p>
              </div>
            ) : registryItems.length === 0 ? (
              <div className="py-20 text-center bg-white rounded border border-dashed border-gray-200">
                <p className="text-gray-400 italic">No items in the registry yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {registryItems.map((item) => (
                  <div
                    key={item.id}
                    className={`bg-white rounded shadow-sm overflow-hidden border transition-all ${
                      item.is_purchased ? 'opacity-60 grayscale-[0.5]' : 'hover:shadow-md'
                    } ${item.is_favorite ? 'border-[#D4A845] border-2' : 'border-gray-100'}`}
                  >
                    {/* Image */}
                    <div className="aspect-square bg-gray-100 relative">
                      {item.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <span className="text-4xl">🎁</span>
                        </div>
                      )}
                      {item.is_favorite && (
                        <div className="absolute top-2 right-2 bg-[#D4A845] text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest shadow-sm">
                          Must Have
                        </div>
                      )}
                      {item.is_purchased && (
                        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                          <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                            Purchased
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="p-4">
                      <h3 className="font-serif text-lg text-[#1B3B28] truncate mb-1" title={item.name}>
                        {item.name}
                      </h3>
                      <p className="font-serif text-xl text-[#D4A845] mb-2">${Number(item.price).toFixed(2)}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                        <span className="bg-gray-100 px-2 py-0.5 rounded">{item.category}</span>
                        <span className="bg-gray-100 px-2 py-0.5 rounded">{item.store}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleTogglePurchased(item)}
                          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors ${
                            item.is_purchased
                              ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {item.is_purchased ? 'Undo' : 'Mark Purchased'}
                        </button>
                        <button
                          onClick={() => openEditItemModal(item)}
                          className="p-2 text-[#D4A845] hover:bg-[#D4A845]/10 rounded transition-colors"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item)}
                          disabled={deletingItemId === item.id}
                          className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingItemId === item.id ? '...' : '🗑️'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* VENDORS TAB */}
        {activeTab === 'vendors' && (
          <>
            {/* Vendor Management Toolbar */}
            <div className="bg-white rounded shadow-sm p-4 mb-8 flex items-center justify-between border border-gray-100">
              <span className="text-xs uppercase tracking-widest text-gray-500 font-bold">Vendor Management:</span>
              <button
                onClick={openAddVendorModal}
                className="px-4 py-2 bg-[#1B3B28] text-white text-sm font-bold rounded hover:bg-[#2a5a3f] transition-colors flex items-center gap-2"
              >
                <span className="text-lg leading-none">+</span> Add Vendor
              </button>
            </div>

            {vendorsLoading ? (
              <div className="py-20 text-center">
                <p className="font-serif text-[#1B3B28] animate-pulse italic">Loading vendors...</p>
              </div>
            ) : vendors.length === 0 ? (
              <div className="py-20 text-center bg-white rounded border border-dashed border-gray-200">
                <p className="text-gray-400 italic">No vendors added yet.</p>
              </div>
            ) : (
              <div className="bg-white rounded shadow-sm overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#1B3B28] text-white text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-4">Category</th>
                        <th className="p-4">Name</th>
                        <th className="p-4">Contact</th>
                        <th className="p-4">Welcome Message</th>
                        <th className="p-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {vendors.map((vendor) => (
                        <tr key={vendor.id} className="hover:bg-gray-50">
                          <td className="p-4">
                            <span className="bg-gray-100 text-gray-600 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded">
                              {vendor.category}
                            </span>
                          </td>
                          <td className="p-4 font-medium text-[#1B3B28]">{vendor.name}</td>
                          <td className="p-4 text-sm text-gray-500">
                            {vendor.email && <div>{vendor.email}</div>}
                            {vendor.phone && <div>{vendor.phone}</div>}
                            {!vendor.email && !vendor.phone && <span className="italic text-gray-300">No contact info</span>}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSendVendorWelcome(vendor.id, 'email')}
                                disabled={!vendor.email || sendingVendorId === `${vendor.id}-email`}
                                className="px-3 py-1.5 border border-[#D4A845] text-[#D4A845] text-xs font-bold rounded hover:bg-[#D4A845] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                {sendingVendorId === `${vendor.id}-email` ? '...' : 'Send Email'}
                              </button>
                              <button
                                onClick={() => handleSendVendorWelcome(vendor.id, 'sms')}
                                disabled={!vendor.phone || sendingVendorId === `${vendor.id}-sms`}
                                className="px-3 py-1.5 border border-[#D4A845] text-[#D4A845] text-xs font-bold rounded hover:bg-[#D4A845] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                {sendingVendorId === `${vendor.id}-sms` ? '...' : 'Send SMS'}
                              </button>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => openEditVendorModal(vendor)}
                                className="p-2 text-gray-400 hover:text-[#1B3B28] rounded transition-colors"
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteVendor(vendor.id)}
                                disabled={deletingVendorId === vendor.id}
                                className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                title="Delete"
                              >
                                {deletingVendorId === vendor.id ? '...' : '🗑️'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col relative overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex-shrink-0 flex items-center justify-between bg-white z-10">
              <h2 className="font-serif text-2xl text-[#1B3B28]">
                {editingParty ? 'Edit Party' : 'Add New Party'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
                title="Close"
              >
                &times;
              </button>
            </div>

            {/* Scrollable Content */}
            <div 
              className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0"
              style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
            >
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">
                  Party Name *
                </label>
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="e.g., The Smith Family"
                  className="w-full px-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] bg-white text-black"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">
                  Family Side
                </label>
                <div className="flex gap-3">
                  {(['', 'bride', 'groom'] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setPartyFamilySide(side)}
                      className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-widest transition-colors border ${
                        partyFamilySide === side
                          ? side === 'bride'
                            ? 'bg-pink-500 text-white border-pink-500'
                            : side === 'groom'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-gray-200 text-gray-600 border-gray-200'
                          : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {side === '' ? 'Unassigned' : side === 'bride' ? "Bride's Side" : "Groom's Side"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Emails */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">
                  Email Addresses
                </label>
                <div className="space-y-2">
                  {partyEmails.map((email, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          const updated = [...partyEmails];
                          updated[idx] = e.target.value;
                          setPartyEmails(updated);
                        }}
                        placeholder="email@example.com"
                        className="flex-1 px-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] bg-white text-black"
                      />
                      {partyEmails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPartyEmails(partyEmails.filter((_, i) => i !== idx))}
                          className="px-3 py-2 text-red-500 hover:bg-red-50 rounded"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPartyEmails([...partyEmails, ''])}
                  className="mt-2 text-sm text-[#D4A845] hover:underline"
                >
                  + Add another email
                </button>
              </div>

              {/* Phones */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">
                  Phone Numbers
                </label>
                <div className="space-y-2">
                  {partyPhones.map((phone, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          const updated = [...partyPhones];
                          updated[idx] = e.target.value;
                          setPartyPhones(updated);
                        }}
                        placeholder="+1234567890"
                        className="flex-1 px-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] bg-white text-black"
                      />
                      {partyPhones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPartyPhones(partyPhones.filter((_, i) => i !== idx))}
                          className="px-3 py-2 text-red-500 hover:bg-red-50 rounded"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPartyPhones([...partyPhones, ''])}
                  className="mt-2 text-sm text-[#D4A845] hover:underline"
                >
                  + Add another phone
                </button>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">
                  Guests *
                </label>
                <div className="space-y-3">
                  {guests.map((guest, index) => (
                    <div key={guest.id || `new-${index}`} className="p-3 border border-gray-100 rounded bg-gray-50/50">
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={guest.name}
                          onChange={(e) => handleGuestChange(index, 'name', e.target.value)}
                          placeholder={`Guest ${index + 1} name *`}
                          className="flex-1 px-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] bg-white text-black"
                        />
                        {guests.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGuest(index)}
                            className="px-3 py-2 text-red-500 hover:bg-red-50 rounded border border-gray-200"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                      <input
                        type="email"
                        value={guest.email || ''}
                        onChange={(e) => handleGuestChange(index, 'email', e.target.value)}
                        placeholder="Guest email (optional)"
                        className="w-full px-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] bg-white text-black text-sm mb-2"
                      />
                      <input
                        type="tel"
                        value={guest.phone || ''}
                        onChange={(e) => handleGuestChange(index, 'phone', e.target.value)}
                        placeholder="Guest phone (optional — only if known to be theirs specifically)"
                        className="w-full px-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] bg-white text-black text-sm"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddGuest}
                  className="mt-3 text-sm text-[#D4A845] hover:underline"
                >
                  + Add another guest
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex-shrink-0 flex justify-end gap-4 bg-white z-10">
              <button
                onClick={closeModal}
                className="px-6 py-2 border border-gray-200 rounded hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveParty}
                disabled={saving}
                className="px-6 py-2 bg-[#1B3B28] text-white rounded hover:bg-[#2a5a3f] transition-colors text-sm font-bold disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingParty ? 'Update Party' : 'Save Party'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registry Item Modal */}
      {showRegistryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col relative overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-serif text-2xl text-[#1B3B28]">
                {editingItem ? 'Edit Gift' : 'Add New Gift'}
              </h2>
            </div>

            <div 
              className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0"
              style={{ overscrollBehavior: 'contain' }}
            >
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g., KitchenAid Stand Mixer"
                  className="w-full px-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] bg-white text-black"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">
                  Price ($) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] bg-white text-black"
                  />
                </div>
              </div>

              {/* Category & Store */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">
                    Category
                  </label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] bg-white text-black"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">
                    Store
                  </label>
                  <select
                    value={itemStore}
                    onChange={(e) => setItemStore(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] bg-white text-black"
                  >
                    {STORES.map((store) => (
                      <option key={store} value={store}>
                        {store}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product URL */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">
                  Product URL
                </label>
                <input
                  type="url"
                  value={itemProductUrl}
                  onChange={(e) => setItemProductUrl(e.target.value)}
                  placeholder="https://amazon.com/product/..."
                  className="w-full px-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] bg-white text-black"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">
                  Image URL
                </label>
                <input
                  type="url"
                  value={itemImageUrl}
                  onChange={(e) => setItemImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] bg-white text-black"
                />
                {itemImageUrl && (
                  <div className="mt-2 w-20 h-20 rounded overflow-hidden border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={itemImageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Is Favorite Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setItemIsFavorite(!itemIsFavorite)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    itemIsFavorite ? 'bg-[#D4A845]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      itemIsFavorite ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
                <label className="text-sm text-[#1B3B28]">
                  Mark as &quot;Must Have&quot;
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex-shrink-0 flex justify-end gap-4 bg-white">
              <button
                onClick={closeRegistryModal}
                className="px-6 py-2 border border-gray-200 rounded hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                disabled={savingItem}
                className="px-6 py-2 bg-[#1B3B28] text-white rounded hover:bg-[#2a5a3f] transition-colors text-sm font-bold disabled:opacity-50"
              >
                {savingItem ? 'Saving...' : editingItem ? 'Update Gift' : 'Add Gift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Declined Parties Modal */}
      {showDeclinedModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col relative overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex-shrink-0 flex items-center justify-between bg-white z-10">
              <h2 className="font-serif text-2xl text-[#1B3B28]">
                Declined ({rsvpBreakdown.declinedParties.length})
              </h2>
              <button
                onClick={() => setShowDeclinedModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <div
              className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0"
              style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
            >
              {rsvpBreakdown.declinedParties.length === 0 ? (
                <p className="text-sm text-gray-500">No declines yet.</p>
              ) : (
                rsvpBreakdown.declinedParties.map(party => (
                  <div key={party.id} className="border border-gray-100 rounded p-4">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <p className="font-bold text-[#1B3B28]">{party.party_name}</p>
                      {party.family_side && (
                        <span
                          className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                            party.family_side === 'bride'
                              ? 'bg-pink-100 text-pink-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}
                        >
                          {party.family_side === 'bride' ? "Bride's Side" : "Groom's Side"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {party.guests.map(g => g.name).filter(Boolean).join(', ') || 'No guests listed'}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex-shrink-0 flex justify-end gap-4 bg-white">
              <button
                onClick={() => setShowDeclinedModal(false)}
                className="px-6 py-2 border border-gray-200 rounded hover:bg-gray-50 transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col relative overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex-shrink-0 flex items-center justify-between bg-white z-10">
              <h2 className="font-serif text-2xl text-[#1B3B28]">
                {editingVendor ? 'Edit Vendor' : 'Add Vendor'}
              </h2>
              <button
                onClick={closeVendorModal}
                className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Category</label>
                <input
                  type="text"
                  value={vendorCategory}
                  onChange={(e) => setVendorCategory(e.target.value)}
                  placeholder="e.g. Catering, Florist, Band..."
                  className="w-full px-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] bg-white text-black"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Name</label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Vendor or business name"
                  className="w-full px-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] bg-white text-black"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Phone</label>
                <input
                  type="tel"
                  value={vendorPhone}
                  onChange={(e) => setVendorPhone(e.target.value)}
                  placeholder="+1..."
                  className="w-full px-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] bg-white text-black"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Email</label>
                <input
                  type="email"
                  value={vendorEmail}
                  onChange={(e) => setVendorEmail(e.target.value)}
                  placeholder="vendor@example.com"
                  className="w-full px-4 py-2 border border-gray-200 rounded focus:outline-none focus:border-[#D4A845] bg-white text-black"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex-shrink-0 flex justify-end gap-4 bg-white">
              <button
                onClick={closeVendorModal}
                className="px-6 py-2 border border-gray-200 rounded hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVendor}
                disabled={savingVendor}
                className="px-6 py-2 bg-[#1B3B28] text-white rounded hover:bg-[#2a5a3f] transition-colors text-sm font-bold disabled:opacity-50"
              >
                {savingVendor ? 'Saving...' : editingVendor ? 'Update Vendor' : 'Add Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
