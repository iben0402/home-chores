import '@testing-library/jest-dom/vitest'

// Unit tests never touch Firestore: household data functions are mocks with calm defaults
// (signed-in user has no households; any household you open exists and you're a member).
// Tests override them with vi.mocked(...). Pure helpers stay real.
vi.mock('../data/households', async (importOriginal) => {
  const real = await importOriginal<typeof import('../data/households')>()
  return {
    ...real,
    createHousehold: vi.fn(),
    findInvite: vi.fn(),
    getHouseholdPreview: vi.fn(),
    isMember: vi.fn(),
    joinHousehold: vi.fn(),
    watchMyHouseholds: vi.fn((_db, _uid, cb) => {
      cb([])
      return () => {}
    }),
    watchHousehold: vi.fn((_db, hid, cb) => {
      cb({ id: hid, name: 'Flat on Main St', adminUids: ['u1'] })
      return () => {}
    }),
    watchInviteCode: vi.fn((_db, _hid, cb) => {
      cb('K7QM4XRT')
      return () => {}
    }),
    regenerateInviteCode: vi.fn(),
    removeMember: vi.fn(),
    setAdmin: vi.fn(),
    renameHousehold: vi.fn(),
    updateMyName: vi.fn(),
    watchMembers: vi.fn((_db, _hid, cb) => {
      cb([{ uid: 'u1', displayName: 'Anna Nowak', color: 1 }])
      return () => {}
    }),
    watchMembership: vi.fn((_db, _hid, _uid, cb) => {
      cb(true)
      return () => {}
    }),
  }
})

// Rooms: a household starts with General; tests override.
vi.mock('../data/rooms', async (importOriginal) => {
  const real = await importOriginal<typeof import('../data/rooms')>()
  return {
    ...real,
    watchRooms: vi.fn((_db, _hid, cb) => {
      cb([{ id: 'general', name: 'General', icon: 'house', order: 0, isDefault: true }])
      return () => {}
    }),
    addRoom: vi.fn(),
    updateRoom: vi.fn(),
    reorderRooms: vi.fn(),
    deleteRoom: vi.fn(),
  }
})

// Chores: none yet; tests override.
vi.mock('../data/chores', async (importOriginal) => {
  const real = await importOriginal<typeof import('../data/chores')>()
  return {
    ...real,
    watchOpenOccurrences: vi.fn((_db, _hid, cb) => {
      cb([])
      return () => {}
    }),
    createChore: vi.fn(),
    assignOccurrence: vi.fn(),
    updateChore: vi.fn(),
    deleteChore: vi.fn(),
    archiveChore: vi.fn(),
    watchChore: vi.fn((_db, _hid, _id, cb) => {
      cb(null)
      return () => {}
    }),
    completeOccurrence: vi.fn(),
    undoCompletion: vi.fn(),
    takeOccurrence: vi.fn(),
  }
})

// History: empty; tests override.
vi.mock('../data/history', async (importOriginal) => {
  const real = await importOriginal<typeof import('../data/history')>()
  return {
    ...real,
    watchHistory: vi.fn((_db, _hid, cb) => {
      cb([])
      return () => {}
    }),
    undoFromHistory: vi.fn(),
    deleteEntry: vi.fn(),
  }
})
