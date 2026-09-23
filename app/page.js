"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { 
  Truck, Plus, Trash2, AlertTriangle, 
  PackageCheck, Send, RotateCcw, MapPin, Search, Navigation, Clock, Layers, ArrowDownUp
} from "lucide-react"

// DEFINISI 4 LEVEL STRUKTUR BAK TOKO BANGUNAN
// Level 4 = Paling Atas (Top) -> Turun Duluan
// Level 1 = Paling Bawah (Bottom) -> Turun Terakhir
const ITEM_STACK_LEVELS = {
  // LEVEL 4 — Long & Linear (Top / Paling Atas)
  8: { level: 4, name: "Pipa", group: "Level 4 (Top - Pipa/Besi)" },
  2: { level: 4, name: "Besi Kecil", group: "Level 4 (Top - Pipa/Besi)" },
  3: { level: 4, name: "Besi Besar", group: "Level 4 (Top - Pipa/Besi)" },
  9: { level: 4, name: "Tower", group: "Level 4 (Top - Rangka)" },
  6: { level: 4, name: "Usuk", group: "Level 4 (Top - Usuk)" },
  7: { level: 4, name: "Bambu", group: "Level 4 (Top - Bambu)" },

  // LEVEL 3 — Large & Flat (Middle / Lembaran Datar)
  5: { level: 3, name: "Triplek", group: "Level 3 (Middle - Triplek)" },
  12: { level: 3, name: "Gypsum", group: "Level 3 (Middle - Gypsum)" },
  13: { level: 3, name: "Kalsibot", group: "Level 3 (Middle - Kalsibot)" },

  // LEVEL 2 — Heavy & Compact (Lower / Beban Padat Karungan)
  1: { level: 2, name: "Semen", group: "Level 2 (Lower - Semen)" },
  11: { level: 2, name: "Mil", group: "Level 2 (Lower - Mil)" },
  10: { level: 2, name: "Kornis", group: "Level 2 (Lower - Kornis)" },

  // LEVEL 1 — Heavy & Bulk (Bottom / Dasar Bak)
  14: { level: 1, name: "Pasir", group: "Level 1 (Bottom - Pasir)" },
  4: { level: 1, name: "Bata Ringan", group: "Level 1 (Bottom - Bata Ringan)" },
  15: { level: 1, name: "Batako", group: "Level 1 (Bottom - Batako)" }
}

// Fallback pencocokan nama material jika ada barang custom baru
function getItemStackLevel(itemId, itemName = "") {
  if (ITEM_STACK_LEVELS[itemId]) return ITEM_STACK_LEVELS[itemId]

  const lower = itemName.toLowerCase()
  if (
    lower.includes("pipa") || lower.includes("besi") || lower.includes("hollow") ||
    lower.includes("tower") || lower.includes("usuk") || lower.includes("bambu")
  ) {
    return { level: 4, name: itemName, group: "Level 4 (Top)" }
  }
  if (lower.includes("triplek") || lower.includes("gypsum") || lower.includes("kalsibot")) {
    return { level: 3, name: itemName, group: "Level 3 (Middle)" }
  }
  if (lower.includes("semen") || lower.includes("mil") || lower.includes("kornis")) {
    return { level: 2, name: itemName, group: "Level 2 (Lower)" }
  }
  // Default material berat dasar
  return { level: 1, name: itemName, group: "Level 1 (Bottom)" }
}

// Menghitung barang posisi paling atas (level tertinggi) dalam suatu nota
function getOrderTopLevelInfo(order) {
  if (!order.order_items || order.order_items.length === 0) {
    return { maxLevel: 1, topItemName: "-", groupLabel: "Level 1" }
  }

  let maxLevel = 0
  let topItemName = ""
  let groupLabel = ""

  order.order_items.forEach(oi => {
    const itemInfo = getItemStackLevel(oi.item_id, oi.items?.name)
    if (itemInfo.level > maxLevel) {
      maxLevel = itemInfo.level
      topItemName = oi.items?.name || itemInfo.name
      groupLabel = itemInfo.group
    }
  })

  return { maxLevel, topItemName, groupLabel }
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Number((R * c).toFixed(2))
}

const BALI_VIEWBOX = "114.40,-8.00,115.75,-8.90"

function parseCoordinatesFromText(rawText) {
  if (!rawText) return null
  let text = rawText.trim()

  try {
    text = decodeURIComponent(text)
  } catch {}

  text = text.replace(/[\u2010-\u2015\u2212]/g, "-")

  // Format DMS
  const dmsPattern = /(\d{1,2})[°\s]+(\d{1,2})['\s]+(\d{1,2}(?:\.\d+)?)["]?\s*([NSns])[,\s]+(\d{1,3})[°\s]+(\d{1,2})['\s]+(\d{1,2}(?:\.\d+)?)["]?\s*([EWew])/i
  const dmsMatch = text.match(dmsPattern)
  if (dmsMatch) {
    let lat = parseFloat(dmsMatch[1]) + parseFloat(dmsMatch[2]) / 60 + parseFloat(dmsMatch[3]) / 3600
    if (dmsMatch[4].toUpperCase() === "S") lat = -lat

    let lon = parseFloat(dmsMatch[5]) + parseFloat(dmsMatch[6]) / 60 + parseFloat(dmsMatch[7]) / 3600
    if (dmsMatch[8].toUpperCase() === "W") lon = -lon

    return { lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) }
  }

  // Format URL
  const urlPattern = /(?:q=|loc:|@|ll=)?(-?\d{1,2}\.\d{3,})[,\s%20]+(-?\d{1,3}\.\d{3,})/i
  const urlMatch = text.match(urlPattern)
  if (urlMatch) {
    const lat = parseFloat(urlMatch[1])
    const lon = parseFloat(urlMatch[2])
    if (lat >= -9.5 && lat <= -7.5 && lon >= 114.0 && lon <= 116.5) {
      return { lat, lon }
    }
  }

  // Format Desimal Biasa
  const generalPattern = /(-?\d{1,2}\.\d{3,})[,\s]+(-?\d{1,3}\.\d{3,})/
  const match = text.match(generalPattern)
  if (match) {
    return { lat: parseFloat(match[1]), lon: parseFloat(match[2]) }
  }

  return null
}

export default function AdminDashboard() {
  const [vehicles, setVehicles] = useState([])
  const [items, setItems] = useState([])
  const [capacities, setCapacities] = useState([])
  const [orders, setOrders] = useState([])
  const [activeDeliveries, setActiveDeliveries] = useState([])
  const [loading, setLoading] = useState(true)

  // Form Nota Baru
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [address, setAddress] = useState("")
  const [deliveryTime, setDeliveryTime] = useState("")
  const [latitude, setLatitude] = useState(null)
  const [longitude, setLongitude] = useState(null)
  const [geocoding, setGeocoding] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [orderItems, setOrderItems] = useState([{ itemId: 1, quantity: "" }])

  // Batching & Radius
  const [selectedOrders, setSelectedOrders] = useState([])
  const [selectedVehicle, setSelectedVehicle] = useState("carry")
  const [clusterRadius, setClusterRadius] = useState(4)

  useEffect(() => {
    fetchInitialData()
  }, [])

  async function fetchInitialData() {
    setLoading(true)
    const { data: vData } = await supabase.from("vehicles").select("*").order("id")
    const { data: iData } = await supabase.from("items").select("*").order("id")
    const { data: cData } = await supabase.from("vehicle_capacities").select("*")

    if (vData) setVehicles(vData)
    if (iData) setItems(iData)
    if (cData) setCapacities(cData)

    await fetchOrders()
    setLoading(false)
  }

  async function fetchOrders() {
    const { data: pendingData } = await supabase
      .from("orders")
      .select(`
        id, invoice_number, customer_name, address, latitude, longitude, delivery_time, status, created_at,
        order_items ( id, item_id, quantity, items ( name, unit ) )
      `)
      .eq("status", "pending")
      .order("delivery_time", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })

    if (pendingData) setOrders(pendingData)

    const { data: deliveringData } = await supabase
      .from("orders")
      .select(`
        id, invoice_number, customer_name, address, delivery_time, assigned_vehicle, status,
        order_items ( id, item_id, quantity, items ( name, unit ) )
      `)
      .eq("status", "delivering")

    if (deliveringData) setActiveDeliveries(deliveringData)
  }

  async function handleFindGPS() {
    const rawQuery = address.trim()
    if (!rawQuery) {
      alert("Masukkan alamat atau paste titik koordinat / shareloc!")
      return
    }

    setGeocoding(true)
    setSearchResults([])

    const extracted = parseCoordinatesFromText(rawQuery)
    if (extracted) {
      setLatitude(extracted.lat)
      setLongitude(extracted.lon)

      try {
        const rev = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${extracted.lat}&lon=${extracted.lon}`
        )
        const revData = await rev.json()
        if (revData?.display_name) {
          const cleanParts = revData.display_name.split(",").slice(0, 4).join(",")
          setAddress(cleanParts)
        }
      } catch {}

      setGeocoding(false)
      return
    }

    const cleanedQuery = rawQuery
      .replace(/no\.?\s*\d+[a-z]?/gi, "")
      .replace(/rt\s*\d+\s*\/?\s*rw\s*\d+/gi, "")
      .replace(/kota\s+/gi, "")
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    const baliQuery = cleanedQuery.toLowerCase().includes("bali") 
      ? cleanedQuery 
      : `${cleanedQuery}, Bali`

    try {
      let res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(baliQuery)}&viewbox=${BALI_VIEWBOX}&bounded=1&limit=5`
      )
      let data = await res.json()

      if (!data || data.length === 0) {
        res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanedQuery)}&viewbox=${BALI_VIEWBOX}&bounded=1&limit=5`
        )
        data = await res.json()
      }

      if (data && data.length > 0) {
        if (data.length === 1) {
          setLatitude(parseFloat(data[0].lat))
          setLongitude(parseFloat(data[0].lon))
          setSearchResults([])
        } else {
          setSearchResults(data)
        }
      } else {
        alert("Alamat tidak ditemukan di Bali. Coba masukkan nama jalan utama dan kecamatannya, atau paste shareloc.")
      }
    } catch {
      alert("Koneksi peta terganggu. Coba ulangi kembali.")
    } finally {
      setGeocoding(false)
    }
  }

  function handleSelectLocation(loc) {
    setLatitude(parseFloat(loc.lat))
    setLongitude(parseFloat(loc.lon))
    setSearchResults([])
  }

  function handleAddItemRow() {
    setOrderItems([...orderItems, { itemId: items[0]?.id || 1, quantity: "" }])
  }

  function handleRemoveItemRow(index) {
    setOrderItems(orderItems.filter((_, i) => i !== index))
  }

  function handleItemChange(index, field, value) {
    const updated = [...orderItems]
    updated[index][field] = value
    setOrderItems(updated)
  }

  async function handleSubmitOrder(e) {
    e.preventDefault()
    if (!invoiceNumber || !customerName || !address) {
      alert("Mohon lengkapi data nota!")
      return
    }

    const validItems = orderItems.filter(i => Number(i.quantity) > 0)
    if (validItems.length === 0) {
      alert("Masukkan minimal 1 jenis barang!")
      return
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert([{
        invoice_number: invoiceNumber,
        customer_name: customerName,
        address: address,
        delivery_time: deliveryTime ? new Date(deliveryTime).toISOString() : null,
        latitude: latitude,
        longitude: longitude,
        status: "pending"
      }])
      .select()
      .single()

    if (orderError) {
      alert("Gagal simpan nota: " + orderError.message)
      return
    }

    const itemsToInsert = validItems.map(i => ({
      order_id: orderData.id,
      item_id: Number(i.itemId),
      quantity: Number(i.quantity)
    }))

    await supabase.from("order_items").insert(itemsToInsert)

    setInvoiceNumber("")
    setCustomerName("")
    setAddress("")
    setDeliveryTime("")
    setLatitude(null)
    setLongitude(null)
    setSearchResults([])
    setOrderItems([{ itemId: 1, quantity: "" }])
    fetchOrders()
  }

  async function handleDeleteOrder(orderId) {
    if (!confirm("Yakin ingin menghapus nota ini?")) return
    const { error } = await supabase.from("orders").delete().eq("id", orderId)
    if (!error) {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId))
      fetchOrders()
    }
  }

  function toggleOrderSelection(orderId) {
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId))
    } else {
      setSelectedOrders([...selectedOrders, orderId])
    }
  }

  // ALGORITMA CLUSTERING BERDASARKAN ATURAN 4 LEVEL LIFO
  function buildClusters() {
    const visited = new Set()
    const clusters = []

    orders.forEach(order => {
      if (visited.has(order.id)) return

      const currentCluster = [order]
      visited.add(order.id)

      if (order.latitude && order.longitude) {
        orders.forEach(other => {
          if (!visited.has(other.id) && other.latitude && other.longitude) {
            const dist = getDistanceKm(order.latitude, order.longitude, other.latitude, other.longitude)
            if (dist <= clusterRadius) {
              currentCluster.push(other)
              visited.add(other.id)
            }
          }
        })
      }

      // ATURAN URUTAN BONGKAR:
      // Nota yang punya barang di LEVEL 4 (Paling Atas) HARUS turun duluan (Stop 1)
      // Nota yang punya barang di LEVEL 1 (Paling Bawah) turun terakhir (Stop Akhir)
      currentCluster.sort((a, b) => {
        const topA = getOrderTopLevelInfo(a).maxLevel
        const topB = getOrderTopLevelInfo(b).maxLevel

        // Urutkan dari level terbesar ke terkecil (4 -> 3 -> 2 -> 1)
        if (topA !== topB) {
          return topB - topA
        }

        // Jika level sama, utamakan yang jadwal target kirimnya lebih awal
        if (a.delivery_time && b.delivery_time) {
          return new Date(a.delivery_time) - new Date(b.delivery_time)
        }
        return 0
      })

      clusters.push(currentCluster)
    })

    return clusters
  }

  function calculateLoad() {
    let totalPercentage = 0
    let incompatibility = []

    const selectedOrderData = orders.filter(o => selectedOrders.includes(o.id))

    selectedOrderData.forEach(order => {
      order.order_items.forEach(orderItem => {
        const cap = capacities.find(
          c => c.vehicle_code === selectedVehicle && c.item_id === orderItem.item_id
        )

        if (!cap || Number(cap.max_capacity) <= 0) {
          incompatibility.push(`${orderItem.items?.name} tidak bisa dibawa armada ini`)
        } else {
          const loadPart = (Number(orderItem.quantity) / Number(cap.max_capacity)) * 100
          totalPercentage += loadPart
        }
      })
    })

    return {
      percentage: Math.round(totalPercentage),
      isIncompatible: incompatibility.length > 0,
      incompatibilityReason: [...new Set(incompatibility)].join(", ")
    }
  }

  async function handleDispatch() {
    if (selectedOrders.length === 0) return
    const vehicleObj = vehicles.find(v => v.code === selectedVehicle)

    if (vehicleObj.status === "on_duty") {
      alert("Armada ini sedang di jalan!")
      return
    }

    if (loadInfo.percentage > 100) {
      alert("Kelebihan muatan! Kurangi barang terlebih dahulu.")
      return
    }

    if (loadInfo.isIncompatible) {
      alert("Ada muatan yang dilarang untuk jenis armada ini!")
      return
    }

    await supabase.from("vehicles").update({ status: "on_duty" }).eq("code", selectedVehicle)
    await supabase.from("orders").update({ status: "delivering", assigned_vehicle: selectedVehicle }).in("id", selectedOrders)

    setSelectedOrders([])
    const { data: vData } = await supabase.from("vehicles").select("*").order("id")
    if (vData) setVehicles(vData)
    fetchOrders()
  }

  async function handleVehicleReturn(vehicleCode) {
    if (!confirm("Selesaikan pengantaran dan kembalikan mobil ke status standby?")) return

    await supabase.from("orders").update({ status: "completed" }).eq("assigned_vehicle", vehicleCode).eq("status", "delivering")
    await supabase.from("vehicles").update({ status: "standby" }).eq("code", vehicleCode)

    const { data: vData } = await supabase.from("vehicles").select("*").order("id")
    if (vData) setVehicles(vData)
    fetchOrders()
  }

  const loadInfo = calculateLoad()
  const activeVehicle = vehicles.find(v => v.code === selectedVehicle)
  const clusters = buildClusters()

  // Ambil nota terpilih, urutkan dari Level 4 (turun duluan) ke Level 1 (turun terakhir)
  const sortedSelectedOrders = orders
    .filter(o => selectedOrders.includes(o.id))
    .sort((a, b) => getOrderTopLevelInfo(b).maxLevel - getOrderTopLevelInfo(a).maxLevel)

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-6">
      <header className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Truck className="text-blue-600" /> Sistem Dispatching Toko Bangunan
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
              Khusus Wilayah Bali
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Prioritas bongkar muat 4 Level LIFO (Level 4 Top → Level 1 Bottom) & kalkulator kapasitas muatan
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* FORM INPUT NOTA */}
        <section className="lg:col-span-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-fit">
          <h2 className="text-base font-bold mb-3 flex items-center gap-2 text-slate-900">
            <Plus className="w-4 h-4 text-blue-600" /> Input Nota Pengiriman Baru
          </h2>

          <form onSubmit={handleSubmitOrder} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nomor Nota</label>
              <input
                type="text"
                placeholder="Contoh: NOTA-105"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Pembeli</label>
              <input
                type="text"
                placeholder="Contoh: Pak Wayan"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Target Tanggal & Jam Pengantaran
              </label>
              <input
                type="datetime-local"
                value={deliveryTime}
                onChange={e => setDeliveryTime(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Alamat / Koordinat Google Maps
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ketik alamat atau paste koordinat"
                  value={address}
                  onChange={e => {
                    setAddress(e.target.value)
                    setLatitude(null)
                    setLongitude(null)
                  }}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={handleFindGPS}
                  disabled={geocoding}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 rounded-lg border border-slate-300 flex items-center gap-1 text-xs shrink-0 font-medium transition"
                >
                  <Search className="w-3.5 h-3.5" />
                  {geocoding ? "Mendeteksi..." : "Cari GPS"}
                </button>
              </div>

              {latitude && longitude ? (
                <p className="text-[11px] text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> GPS Terkunci: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">
                  *Mendukung format derajat 8°32&apos;38.7&quot;S, desimal, maupun link WA
                </p>
              )}

              {searchResults.length > 0 && (
                <div className="mt-2 p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1.5">
                  <p className="text-[11px] font-bold text-blue-900">
                    Pilih lokasi di Bali yang sesuai:
                  </p>
                  {searchResults.map((loc, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectLocation(loc)}
                      className="w-full text-left p-2 rounded bg-white hover:bg-blue-100 text-xs border border-blue-100 text-slate-700 transition flex items-start gap-1.5"
                    >
                      <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{loc.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Rincian Barang */}
            <div className="border-t pt-3">
              <label className="block text-xs font-semibold text-slate-600 mb-2">Daftar Barang</label>
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {orderItems.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={row.itemId}
                      onChange={e => handleItemChange(idx, "itemId", e.target.value)}
                      className="border border-slate-300 rounded-lg p-1.5 text-xs flex-1 bg-white"
                    >
                      {items.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.unit})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="any"
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={e => handleItemChange(idx, "quantity", e.target.value)}
                      className="w-16 border border-slate-300 rounded-lg p-1.5 text-xs text-center"
                      required
                    />
                    {orderItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-semibold"
              >
                + Tambah Barang Lain
              </button>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-sm transition mt-2 shadow-sm"
            >
              Simpan Nota ke Antrean
            </button>
          </form>
        </section>

        {/* KOLOM KANAN */}
        <section className="lg:col-span-8 space-y-6">
          {/* ALOKASI ARMADA */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-slate-900">Alokasi Mobil Pengangkut</h2>
              <span className="text-xs text-slate-500">Pilih armada yang standby</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
              {vehicles.map(v => {
                const isOnDuty = v.status === "on_duty"
                return (
                  <button
                    key={v.code}
                    type="button"
                    disabled={isOnDuty}
                    onClick={() => setSelectedVehicle(v.code)}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      isOnDuty
                        ? "bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed"
                        : selectedVehicle === v.code
                        ? "border-blue-600 bg-blue-50 text-blue-800 font-bold shadow-sm"
                        : "border-slate-200 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider">{v.code}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                        isOnDuty ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {isOnDuty ? "Di Jalan" : "Standby"}
                      </span>
                    </div>
                    <p className="text-xs font-semibold truncate">{v.name}</p>
                  </button>
                )
              })}
            </div>

            {/* Meteran Beban */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-semibold text-slate-600">
                  Total Beban ({selectedOrders.length} Nota Dipilih untuk {activeVehicle?.name}):
                </span>
                <span className={`text-base font-bold ${
                  loadInfo.percentage > 100 ? "text-red-600" : "text-emerald-600"
                }`}>
                  {loadInfo.percentage}%
                </span>
              </div>

              <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    loadInfo.percentage > 100
                      ? "bg-red-500"
                      : loadInfo.percentage >= 80
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(loadInfo.percentage, 100)}%` }}
                />
              </div>

              {loadInfo.percentage > 100 && (
                <p className="text-xs text-red-600 font-semibold mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> Kelebihan muatan! Kurangi barang atau ganti armada.
                </p>
              )}
              {loadInfo.isIncompatible && (
                <p className="text-xs text-amber-700 font-semibold mt-1">
                  Peringatan: {loadInfo.incompatibilityReason}
                </p>
              )}

              {/* URUTAN RUTE BONGKAR LIFO */}
              {sortedSelectedOrders.length > 1 && (
                <div className="mt-3.5 pt-3 border-t border-slate-200 bg-white p-3 rounded-lg border">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2">
                    <ArrowDownUp className="w-4 h-4 text-blue-600" />
                    Urutan Rute Pengantaran (Berdasarkan Lapisan Barang di Bak):
                  </div>

                  <div className="space-y-1.5 mb-3">
                    {sortedSelectedOrders.map((ord, idx) => {
                      const topInfo = getOrderTopLevelInfo(ord)
                      return (
                        <div key={ord.id} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded border border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded text-[10px]">
                              STOP {idx + 1}
                            </span>
                            <span className="font-semibold text-slate-800">{ord.invoice_number} ({ord.customer_name})</span>
                          </div>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            topInfo.maxLevel === 4
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : topInfo.maxLevel === 3
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : topInfo.maxLevel === 2
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}>
                            {idx === 0 ? "Turun Pertama" : `Turun Ke-${idx + 1}`} (Level {topInfo.maxLevel} — Bawa {topInfo.topItemName})
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Panduan Kuli Toko */}
                  <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-[11px] text-amber-900 flex items-start gap-1.5">
                    <Layers className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Instruksi Pemuatan Bak (LIFO untuk Kuli/Kenek):</p>
                      <p className="mt-0.5">
                        Muat muatan dasar milik <b>{sortedSelectedOrders[sortedSelectedOrders.length - 1]?.invoice_number}</b> (Level {getOrderTopLevelInfo(sortedSelectedOrders[sortedSelectedOrders.length - 1]).maxLevel}) terlebih dahulu ke bak bawah, lalu tumpuk muatan <b>{sortedSelectedOrders[0]?.invoice_number}</b> (Level {getOrderTopLevelInfo(sortedSelectedOrders[0]).maxLevel}) di lapisan atas agar langsung siap dibongkar di Stop 1.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-3 border-t flex justify-end">
                <button
                  type="button"
                  disabled={
                    selectedOrders.length === 0 || 
                    loadInfo.percentage > 100 || 
                    loadInfo.isIncompatible ||
                    activeVehicle?.status === "on_duty"
                  }
                  onClick={handleDispatch}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg text-xs flex items-center gap-2 shadow-sm transition"
                >
                  <Send className="w-4 h-4" /> Berangkatkan {activeVehicle?.name} ({selectedOrders.length} Nota)
                </button>
              </div>
            </div>
          </div>

          {/* ARMADA SEDANG DI JALAN */}
          {vehicles.some(v => v.status === "on_duty") && (
            <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200">
              <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-600" /> Armada Sedang Mengantar di Jalan
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {vehicles.filter(v => v.status === "on_duty").map(v => {
                  const runningOrders = activeDeliveries.filter(o => o.assigned_vehicle === v.code)
                  return (
                    <div key={v.code} className="bg-white p-3.5 rounded-lg border border-amber-200 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-sm text-slate-800">{v.name}</span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                            {runningOrders.length} Nota Diantar
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                          Nomor Nota: {runningOrders.map(o => o.invoice_number).join(", ")}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleVehicleReturn(v.code)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-1.5 rounded text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Selesai Kirim & Mobil Kembali
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* RUTE KLASTER GPS */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2 text-slate-900">
                  <Navigation className="w-5 h-5 text-blue-600" />
                  Rute Klaster GPS ({orders.length} Nota Menunggu)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Diurutkan otomatis: Level 4 (Top) turun pertama Level 1 (Bottom) turun terakhir
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                <span className="text-xs font-semibold text-slate-600">Radius:</span>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={clusterRadius}
                  onChange={e => setClusterRadius(Number(e.target.value))}
                  className="w-20 accent-blue-600 cursor-pointer"
                />
                <span className="text-xs font-bold text-blue-600 w-8">{clusterRadius} km</span>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-slate-400">Memuat antrean...</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">Tidak ada nota yang menunggu dikirim.</p>
            ) : (
              <div className="space-y-4">
                {clusters.map((cluster, cIdx) => {
                  const clusterOrderIds = cluster.map(o => o.id)
                  const allSelected = clusterOrderIds.every(id => selectedOrders.includes(id))

                  return (
                    <div key={cIdx} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60">
                      <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-600 text-white font-bold text-[11px] px-2 py-0.5 rounded-md">
                            Rute {cIdx + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-700">
                            {cluster.length} Nota Berdekatan (Jarak ≤ {clusterRadius} km)
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (allSelected) {
                              setSelectedOrders(selectedOrders.filter(id => !clusterOrderIds.includes(id)))
                            } else {
                              setSelectedOrders(Array.from(new Set([...selectedOrders, ...clusterOrderIds])))
                            }
                          }}
                          className="text-[11px] bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 font-semibold px-2.5 py-1 rounded transition"
                        >
                          {allSelected ? "Batalkan Pilihan Rute" : "Pilih Semua Nota di Rute Ini"}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {cluster.map((order, oIdx) => {
                          const topInfo = getOrderTopLevelInfo(order)
                          return (
                            <div
                              key={order.id}
                              className={`p-3 rounded-lg border bg-white transition flex items-start justify-between ${
                                selectedOrders.includes(order.id)
                                  ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50/20"
                                  : "border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <div
                                className="flex-1 cursor-pointer"
                                onClick={() => toggleOrderSelection(order.id)}
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                    oIdx === 0 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                                  }`}>
                                    STOP {oIdx + 1}
                                  </span>

                                  <span className="font-bold text-sm text-slate-800">{order.invoice_number}</span>
                                  <span className="text-xs font-medium text-slate-500">• {order.customer_name}</span>
                                  
                                  {/* Badge Level Tumpukan */}
                                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded border flex items-center gap-1 ${
                                    topInfo.maxLevel === 4
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : topInfo.maxLevel === 3
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : topInfo.maxLevel === 2
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-slate-100 text-slate-700 border-slate-200"
                                  }`}>
                                    <Layers className="w-3 h-3" /> Level {topInfo.maxLevel} (Bawa {topInfo.topItemName})
                                  </span>

                                  {order.delivery_time && (
                                    <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-amber-600" />
                                      {new Date(order.delivery_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  {order.address}
                                </p>

                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {order.order_items.map((oi, i) => (
                                    <span key={i} className="text-[11px] bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                                      {oi.items?.name}: <b>{oi.quantity} {oi.items?.unit}</b>
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 pl-3">
                                <input
                                  type="checkbox"
                                  checked={selectedOrders.includes(order.id)}
                                  onChange={() => toggleOrderSelection(order.id)}
                                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                                />
                                <button
                                  type="button"
                                  title="Hapus Nota"
                                  onClick={() => handleDeleteOrder(order.id)}
                                  className="text-slate-400 hover:text-red-600 p-1 transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}