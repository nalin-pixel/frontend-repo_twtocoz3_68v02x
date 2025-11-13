import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { Plus, Home, LogIn, LogOut, FileText, User, Building2, ListFilter, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])
  return { user, loading }
}

async function apiFetch(path, options = {}) {
  const token = await auth.currentUser?.getIdToken?.()
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API}${path}`, { ...options, headers })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

function Navbar({ user }) {
  const navigate = useNavigate()
  return (
    <div className="w-full bg-white/80 backdrop-blur border-b sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Building2 className="w-5 h-5" /> RentFlow
        </Link>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link to="/dashboard" className="px-3 py-1.5 rounded bg-blue-600 text-white">Dashboard</Link>
              <button onClick={() => signOut(auth)} className="flex items-center gap-1 px-3 py-1.5 rounded border">
                <LogOut className="w-4 h-4"/> Logout
              </button>
            </>
          ) : (
            <button onClick={async () => { await signInWithPopup(auth, new GoogleAuthProvider()) }} className="flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 text-white">
              <LogIn className="w-4 h-4"/> Login
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function HomePage() {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg p-8 shadow-sm border">
        <h1 className="text-2xl font-bold mb-2">Find your next home</h1>
        <p className="text-gray-600">Search, filter, and request to rent. Landlords manage listings and approve tenants.</p>
        <div className="mt-6">
          <Link to="/listings" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded">
            <Search className="w-4 h-4"/> Browse Listings
          </Link>
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [role, setRole] = useState('tenant')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const me = await apiFetch('/users/me')
        if (me.exists) {
          setProfile(me.user)
          setRole(me.user.role)
        }
      } catch (e) {}
    })()
  }, [user])

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        auth_uid: user.uid,
        email: user.email,
        display_name: user.displayName,
        role,
      }
      const saved = await apiFetch('/users/me', { method: 'POST', body: JSON.stringify(payload) })
      setProfile(saved)
    } finally {
      setSaving(false)
    }
  }

  if (!user) return <div className="max-w-6xl mx-auto p-6">Please login to access your dashboard.</div>
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white p-6 rounded border">
        <h2 className="font-semibold text-lg">Profile</h2>
        <p className="text-sm text-gray-600">Signed in as {user.email}</p>
        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} className="border rounded px-3 py-2">
            <option value="tenant">Tenant</option>
            <option value="landlord">Landlord</option>
          </select>
          <button onClick={save} disabled={saving} className="ml-3 px-4 py-2 bg-blue-600 text-white rounded">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <LandlordPanel />
        <TenantPanel />
      </div>
    </div>
  )
}

function LandlordPanel() {
  const { user } = useAuth()
  const [me, setMe] = useState(null)
  const [form, setForm] = useState({ title: '', address: '', city: '', state: '', rent: 1000, bedrooms: 1, bathrooms: 1, description: '' })
  const [listings, setListings] = useState([])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const me = await apiFetch('/users/me')
      setMe(me.user)
    })()
  }, [user])

  const create = async () => {
    await apiFetch('/listings', { method: 'POST', body: JSON.stringify({ ...form }) })
    await refresh()
  }
  const refresh = async () => {
    const res = await apiFetch('/listings?page=1&page_size=50')
    setListings(res.items.filter(l => l.landlord_uid === user.uid))
  }
  useEffect(() => { if (user) refresh() }, [user])

  if (!me || me.role !== 'landlord') return (
    <div className="bg-white p-6 rounded border">
      <h3 className="font-semibold">Landlord</h3>
      <p className="text-gray-600 text-sm">Set your role to Landlord to manage listings.</p>
    </div>
  )

  return (
    <div className="bg-white p-6 rounded border">
      <h3 className="font-semibold mb-3">Create Listing</h3>
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Title" className="border rounded px-2 py-1" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
        <input placeholder="Address" className="border rounded px-2 py-1" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/>
        <input placeholder="City" className="border rounded px-2 py-1" value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/>
        <input placeholder="State" className="border rounded px-2 py-1" value={form.state} onChange={e=>setForm({...form,state:e.target.value})}/>
        <input placeholder="Rent" type="number" className="border rounded px-2 py-1" value={form.rent} onChange={e=>setForm({...form,rent:parseFloat(e.target.value)})}/>
        <input placeholder="Bedrooms" type="number" className="border rounded px-2 py-1" value={form.bedrooms} onChange={e=>setForm({...form,bedrooms:parseInt(e.target.value)})}/>
        <input placeholder="Bathrooms" type="number" className="border rounded px-2 py-1" value={form.bathrooms} onChange={e=>setForm({...form,bathrooms:parseFloat(e.target.value)})}/>
        <input placeholder="Description" className="col-span-2 border rounded px-2 py-1" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
      </div>
      <button onClick={create} className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded">Create</button>

      <h4 className="mt-6 font-semibold">My Listings</h4>
      <ul className="divide-y">
        {listings.map(l => (
          <li key={l.id} className="py-2 flex items-center justify-between">
            <div>
              <div className="font-medium">{l.title}</div>
              <div className="text-sm text-gray-600">{l.city}, {l.state} • ${l.rent}</div>
            </div>
            <Link to={`/listings/${l.id}`} className="text-blue-600">Open</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TenantPanel() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  useEffect(() => { if (user) refresh() }, [user])
  const refresh = async () => {
    const res = await apiFetch('/requests')
    setRequests(res.items)
  }
  return (
    <div className="bg-white p-6 rounded border">
      <h3 className="font-semibold mb-3">Tenant</h3>
      <p className="text-sm text-gray-600">Track your rental requests and agreements.</p>
      <ul className="divide-y mt-3">
        {requests.map(r => (
          <li key={r.id} className="py-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Request for listing {r.listing_id}</div>
                <div className="text-sm text-gray-600">Status: {r.status}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ListingsPage() {
  const { user } = useAuth()
  const [query, setQuery] = useState({ q: '', city: '', state: '', min_rent: '', max_rent: '', bedrooms: '' })
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  const fetchListings = async () => {
    const params = new URLSearchParams()
    Object.entries(query).forEach(([k, v]) => { if (v) params.append(k, v) })
    params.append('page', page)
    params.append('page_size', pageSize)
    params.append('sort_by', sortBy)
    params.append('sort_dir', sortDir)
    const res = await apiFetch(`/listings?${params.toString()}`)
    setItems(res.items)
    setTotal(res.total)
  }

  useEffect(() => { fetchListings() }, [page, pageSize, sortBy, sortDir])

  const pages = Math.ceil(total / pageSize)

  const requestToRent = async (listingId) => {
    await apiFetch('/requests', { method: 'POST', body: JSON.stringify({ listing_id: listingId, message: 'I am interested' }) })
    alert('Request sent!')
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white p-4 rounded border mb-4">
        <div className="grid md:grid-cols-6 gap-2">
          <input placeholder="Search" className="border rounded px-2 py-1" value={query.q} onChange={e=>setQuery({...query,q:e.target.value})}/>
          <input placeholder="City" className="border rounded px-2 py-1" value={query.city} onChange={e=>setQuery({...query,city:e.target.value})}/>
          <input placeholder="State" className="border rounded px-2 py-1" value={query.state} onChange={e=>setQuery({...query,state:e.target.value})}/>
          <input placeholder="Min Rent" className="border rounded px-2 py-1" value={query.min_rent} onChange={e=>setQuery({...query,min_rent:e.target.value})}/>
          <input placeholder="Max Rent" className="border rounded px-2 py-1" value={query.max_rent} onChange={e=>setQuery({...query,max_rent:e.target.value})}/>
          <input placeholder="Bedrooms" className="border rounded px-2 py-1" value={query.bedrooms} onChange={e=>setQuery({...query,bedrooms:e.target.value})}/>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="border rounded px-2 py-1">
            <option value="created_at">Newest</option>
            <option value="rent">Rent</option>
            <option value="bedrooms">Bedrooms</option>
          </select>
          <select value={sortDir} onChange={e=>setSortDir(e.target.value)} className="border rounded px-2 py-1">
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
          <button onClick={() => { setPage(1); fetchListings() }} className="px-3 py-1.5 bg-blue-600 text-white rounded">Apply</button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {items.map(l => (
          <div key={l.id} className="bg-white rounded border p-4 flex flex-col">
            <div className="font-semibold text-lg">{l.title}</div>
            <div className="text-gray-600 text-sm">{l.address}, {l.city}, {l.state}</div>
            <div className="mt-1">${l.rent} / mo • {l.bedrooms} bd / {l.bathrooms} ba</div>
            <div className="mt-3 flex gap-2">
              <Link to={`/listings/${l.id}`} className="px-3 py-1.5 border rounded">View</Link>
              {user && <button onClick={() => requestToRent(l.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded">Request</button>}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-2">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page===1} className="px-2 py-1 border rounded"><ChevronLeft className="w-4 h-4"/></button>
        <span className="text-sm">Page {page} of {pages || 1}</span>
        <button onClick={() => setPage(p => (pages ? Math.min(pages, p + 1) : p + 1))} disabled={pages>0 && page===pages} className="px-2 py-1 border rounded"><ChevronRight className="w-4 h-4"/></button>
      </div>
    </div>
  )
}

function AppShell() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar user={user} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/listings" element={<ListingsPage />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
