type ServedHandler = (request: Request) => Response | Promise<Response>

type ProfileRow = {
  id: string
  email: string | null
  display_name: string | null
  role: string
  is_active: boolean
  created_at: string
}

type DevUserRow = {
  user_id: string
}

type Account = {
  id: string
  email: string
  display_name: string | null
  role: string
  is_active: boolean
  created_at: string
}

const realUserId = '00000000-0000-4000-8000-000000000001'
const joshUserId = '00000000-0000-4000-8000-000000000002'
const anonymousDevUserId = '00000000-0000-4000-8000-000000000003'

const profiles: ProfileRow[] = [
  {
    id: realUserId,
    email: 'real-specialist@potomackco.com',
    display_name: 'Real Specialist',
    role: 'specialist',
    is_active: true,
    created_at: '2026-05-19T10:00:00Z',
  },
  {
    id: joshUserId,
    email: 'josh@potomackco.com',
    display_name: 'Josh',
    role: 'admin',
    is_active: true,
    created_at: '2026-05-19T11:00:00Z',
  },
  {
    id: anonymousDevUserId,
    email: '',
    display_name: 'Anonymous Dev',
    role: 'specialist',
    is_active: true,
    created_at: '2026-05-19T12:00:00Z',
  },
]

const devUsers: DevUserRow[] = [
  { user_id: joshUserId },
  { user_id: anonymousDevUserId },
]

async function loadHandler(adminUserId: string): Promise<ServedHandler> {
  const originalServeDescriptor = Object.getOwnPropertyDescriptor(Deno, 'serve')
  let servedHandler: ServedHandler | undefined

  Object.defineProperty(Deno, 'serve', {
    configurable: true,
    writable: true,
    value: (...args: unknown[]) => {
      servedHandler = (typeof args[0] === 'function' ? args[0] : args[1]) as ServedHandler
      return {
        finished: Promise.resolve(),
        shutdown: () => {},
        ref: () => {},
        unref: () => {},
        addr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
      }
    },
  })

  ;(globalThis as typeof globalThis & { __adminListUsersTestRuntime?: unknown })
    .__adminListUsersTestRuntime = {
      verifyAdmin: () => Promise.resolve({ userId: adminUserId }),
      createAdminClient: () => ({
        auth: {
          admin: {
            listUsers: () =>
              Promise.resolve({
                data: {
                  users: [
                    { id: realUserId, email: 'real-specialist@potomackco.com' },
                    { id: joshUserId, email: 'josh@potomackco.com' },
                    { id: anonymousDevUserId },
                  ],
                },
                error: null,
              }),
          },
        },
        from: (table: string) => {
          if (table !== 'profiles') throw new Error(`unexpected table: ${table}`)

          return {
            select: () => ({
              order: () => Promise.resolve({ data: profiles, error: null }),
            }),
          }
        },
        schema: (schema: string) => {
          if (schema !== 'private') throw new Error(`unexpected schema: ${schema}`)

          return {
            from: (table: string) => {
              if (table !== 'dev_users') throw new Error(`unexpected table: ${table}`)

              return {
                select: () => Promise.resolve({ data: devUsers, error: null }),
              }
            },
          }
        },
      }),
    }

  try {
    await import(`./index.ts?test=${crypto.randomUUID()}`)
  } finally {
    if (originalServeDescriptor) {
      Object.defineProperty(Deno, 'serve', originalServeDescriptor)
    }
    delete (globalThis as typeof globalThis & { __adminListUsersTestRuntime?: unknown })
      .__adminListUsersTestRuntime
  }

  if (!servedHandler) throw new Error('admin-list-users handler was not registered')
  return servedHandler
}

async function listAccounts(adminUserId: string): Promise<Account[]> {
  const handler = await loadHandler(adminUserId)
  const response = await handler(new Request('https://example.test/admin-list-users', {
    headers: { Authorization: 'Bearer test-token' },
  }))
  const body = await response.json() as { accounts: Account[] }
  return body.accounts
}

Deno.test('non-Josh admin sees no dev accounts', async () => {
  const accounts = await listAccounts(realUserId)

  assertEquals(accounts.map((account) => account.id), [realUserId])
  assertEquals(accounts.some((account) => account.id === joshUserId), false)
  assertEquals(accounts.some((account) => account.id === anonymousDevUserId), false)
})

Deno.test('Josh sees no dev accounts, including his own account', async () => {
  const accounts = await listAccounts(joshUserId)

  assertEquals(accounts.map((account) => account.id), [realUserId])
  assertEquals(accounts.some((account) => account.id === joshUserId), false)
  assertEquals(accounts.some((account) => account.id === anonymousDevUserId), false)
})

Deno.test('real accounts remain visible with unchanged response shape', async () => {
  const accounts = await listAccounts(joshUserId)

  assertEquals(accounts, [
    {
      id: realUserId,
      email: 'real-specialist@potomackco.com',
      display_name: 'Real Specialist',
      role: 'specialist',
      is_active: true,
      created_at: '2026-05-19T10:00:00Z',
    },
  ])
})

function assertEquals(actual: unknown, expected: unknown) {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)

  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`)
  }
}
