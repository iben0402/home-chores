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
      cb({ id: hid, name: 'Flat on Main St', adminUids: ['u1'], inviteCode: 'K7QM4XRT' })
      return () => {}
    }),
    watchMembership: vi.fn((_db, _hid, _uid, cb) => {
      cb(true)
      return () => {}
    }),
  }
})
