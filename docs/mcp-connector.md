# Connector RS Planner dla Claude (MCP)

Connector pozwala korzystać z Plannera bezpośrednio z rozmowy w Claude
(claude.ai, Claude Desktop, Claude Code). Można sprawdzać, kto jest wolny i kto
nad czym pracuje, przeglądać projekty i urlopy, szukać ludzi po kompetencjach
oraz dodawać i zmieniać przydziały, projekty i urlopy.

Adres connectora: `https://planner.rocksoft.pl/api/mcp`

## Jak podłączyć

### claude.ai i Claude Desktop

Connector dodaje raz admin organizacji w claude.ai, w ustawieniach organizacji
w sekcji Connectors: **Add custom connector**, nazwa `RS Planner`, adres jak
wyżej. Potem każdy podłącza go u siebie:

1. Settings → Connectors → **RS Planner** → **Connect**.
2. Otworzy się Planner. Jeśli nie jesteś zalogowany, zaloguj się swoim kontem.
3. Na ekranie „… prosi o dostęp do Plannera” kliknij **Zezwól**.
4. W rozmowie włącz connector w menu narzędzi i zadaj pytanie.

Claude Desktop korzysta z connectorów konta claude.ai, więc po podłączeniu
w przeglądarce działa też tam.

Na planie bez ustawień organizacji connector dodaje się sam: Settings →
Connectors → **Add custom connector**, ten sam adres.

### Claude Code

```
claude mcp add --transport http rs-planner https://planner.rocksoft.pl/api/mcp
```

Potem w Claude Code wpisz `/mcp`, wybierz `rs-planner` → **Authenticate**
i przejdź to samo logowanie w przeglądarce.

### Odłączenie

Odłącz connector w ustawieniach Claude (albo `claude mcp remove rs-planner`).
Dostęp wygasa najpóźniej po czasie życia tokena (domyślnie godzina).

## Co można robić

Przykładowe pytania:

- „Kto ma co najmniej 20 wolnych godzin w przyszłym tygodniu?”
- „Nad czym pracuje Anna w styczniu?”
- „Kto jest przypisany do projektu X i na ile godzin?”
- „Kto jest na urlopie między świętami a Nowym Rokiem?”
- „Mamy projekt w React Native z płatnościami. Kto pasuje najlepiej i ma czas?”
- „Przypisz Tomka do projektu X od 5 do 16 stycznia, 4 godziny dziennie, wstępnie.”
- „Potwierdź wstępny przydział Tomka w projekcie X.”
- „Wpisz mi urlop 22–31 grudnia.”

Przed każdą zmianą Claude pokazuje, co zmieni, i czeka na potwierdzenie.
Obowiązują te same zasady co w aplikacji: przydział nie może zaczynać się ani
kończyć w weekend, a gdy przydział przeciąża osobę, Claude o tym ostrzega.
Dostępność liczona jest tak samo jak na stronie People: przydziały wstępne nie
zajmują czasu, urlopy zmniejszają dostępne godziny.

## Czego connector nie robi

- Nie usuwa projektów (usunięcie kasuje wszystkie przydziały projektu).
- Nie dodaje, nie edytuje i nie usuwa osób (zespół synchronizuje się z kontami
  firmowymi).
- Nie edytuje kompetencji ani historii projektów pracowników (tylko je czyta).
- Nie zmienia ustawień kont, uprawnień ani funkcji administracyjnych.

To dalej robi się w Plannerze.

## Uprawnienia

Claude działa na koncie osoby, która go podłączyła, z dokładnie takimi
uprawnieniami jak w aplikacji: każde zapytanie idzie do bazy z tokenem tej
osoby i przechodzi przez te same reguły dostępu (RLS). Connector nie używa
klucza administratora bazy. Zmiany zrobione przez Claude są zapisywane jako
zmiany tej osoby (`created_by` / `updated_by`).

## Narzędzia

| Narzędzie | Co robi |
|---|---|
| `whoami` | Konto, na którym działa connector, i czy jest adminem |
| `list_people` | Osoby: imię, e-mail, stanowisko, typ umowy, godziny dziennie |
| `list_projects` | Projekty, filtr po nazwie i dniu trwania |
| `get_project` | Projekt z przydziałami i sumą zarezerwowanych godzin |
| `list_allocations` | Przydziały w okresie, filtr po osobie, projekcie, statusie |
| `get_availability` | Wolne i zajęte godziny na osobę w okresie (domyślnie 14 dni) |
| `list_time_off` | Urlopy, L4 i inne nieobecności w okresie |
| `search_experts` | Ranking ludzi dopasowanych do opisu projektu lub kompetencji |
| `get_person_competencies` | Kompetencje i historia projektów jednej osoby |
| `list_competencies` | Katalog umiejętności i technologii |
| `create_allocation` | Nowy przydział (potwierdzony lub wstępny) |
| `update_allocation` | Zmiana przydziału: daty, godziny, projekt, potwierdzenie |
| `delete_allocation` | Usunięcie przydziału |
| `create_project` | Nowy projekt |
| `update_project` | Zmiana nazwy, opisu, dat lub koloru projektu |
| `create_time_off` | Nowy urlop lub nieobecność |
| `update_time_off` | Zmiana urlopu lub nieobecności |
| `delete_time_off` | Usunięcie urlopu lub nieobecności |

## Utrzymanie

### Jak to działa

```
Claude ──POST /api/mcp (Bearer token)──► Planner ──zapytania z tokenem użytkownika──► Supabase (RLS)
   │                                        │
   └── logowanie OAuth 2.1 (PKCE) ──► Supabase Auth ──► /oauth/consent w Plannerze
```

1. Claude wysyła zapytanie bez tokena i dostaje `401` z nagłówkiem
   `WWW-Authenticate`, który wskazuje metadane zasobu
   (`/api/mcp/oauth-protected-resource`). Metadane są pod `/api`, bo nginx na
   RunCloud zwraca 403 dla ścieżek z kropką, w tym `/.well-known/*`. Standardowy
   adres `/.well-known/oauth-protected-resource/api/mcp` też jest obsłużony
   w kodzie, ale działa dopiero, gdy nginx go przepuści.
2. Z metadanych Claude odczytuje serwer autoryzacji (Supabase Auth), rejestruje
   się jako aplikacja (dynamic client registration) i otwiera logowanie.
3. Supabase przekierowuje na `/oauth/consent` w Plannerze. Użytkownik loguje się
   i zatwierdza dostęp, Supabase wydaje token dostępu i token odświeżania.
4. Każde zapytanie do `/api/mcp` jest weryfikowane osobno (podpis ES256 przez
   JWKS Supabase). Serwer nie trzyma sesji i odpowiada zwykłym JSON-em (bez SSE).

### Pliki

| Ścieżka | Rola |
|---|---|
| `src/app/api/mcp/route.ts` | Endpoint MCP (Streamable HTTP, bezstanowy) |
| `src/app/api/mcp/oauth-protected-resource/route.ts` | Metadane zasobu (RFC 9728), adres podawany w `401` |
| `src/app/.well-known/oauth-protected-resource/[[...resource]]/route.ts` | Te same metadane pod standardowym adresem |
| `src/app/oauth/consent/` | Ekran zgody i akcje Zezwól / Odmów |
| `src/lib/mcp/auth.ts` | Weryfikacja tokena, klient Supabase z tokenem użytkownika |
| `src/lib/mcp/config.ts` | Adresy i metadane |
| `src/lib/mcp/server.ts` | Rejestracja narzędzi, instrukcje dla Claude |
| `src/lib/mcp/tools/` | Narzędzia, po jednym pliku na typ danych |
| `src/lib/oauth.ts` | Bezpieczny powrót z logowania na ekran zgody |
| `src/proxy.ts` | Wyjątki: `/api/*` i `/.well-known/*` bez przekierowania na login |

Narzędzia korzystają z tych samych funkcji co UI (`calcUtilization`,
`formatAvailability`, `validateAllocationDates`, `countWorkdays` z
`src/lib/utils.ts`). Zmiana reguł w UI od razu obejmuje connector.

### Konfiguracja (co się zepsuje po zmianie)

| Element | Wartość | Po zmianie |
|---|---|---|
| Supabase → Authentication → OAuth Server | włączony | Logowanie z Claude przestaje działać |
| Authorization Path | `/oauth/consent` | Supabase przekieruje na nieistniejącą stronę |
| Allow Dynamic OAuth Apps | włączone | Claude nie zarejestruje się i nie doda connectora |
| Supabase Site URL | `https://planner.rocksoft.pl` (bez `/` na końcu) | Zły adres ekranu zgody |
| JWT signing keys | asymetryczne (ES256) | `getClaims` nie zweryfikuje tokenów przez JWKS |
| `NEXT_PUBLIC_SITE_URL` | `https://planner.rocksoft.pl` | Zły `resource` w metadanych, Claude odrzuci połączenie |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | jak dla aplikacji | Brak weryfikacji tokenów i dostępu do danych |
| nginx (RunCloud) | `/api/*` trafia do Next.js | Claude nie znajdzie metadanych ani endpointu |

Connector nie potrzebuje `SUPABASE_SERVICE_ROLE_KEY` ani `COMPETENCY_API_KEYS`.

### Sprawdzenie po wdrożeniu

1. `https://planner.rocksoft.pl/api/mcp/oauth-protected-resource`
   zwraca JSON z `"resource": "https://planner.rocksoft.pl/api/mcp"`.
2. `POST https://planner.rocksoft.pl/api/mcp` bez tokena zwraca `401`
   z nagłówkiem `WWW-Authenticate: Bearer resource_metadata="…"`.
3. Podłączenie w Claude, logowanie, **Zezwól**, pytanie o `whoami`.
4. Testowy przydział wstępny: dodanie, zmiana, usunięcie, widoczne w Timeline.

### Testy

`npm test` uruchamia m.in.:

- `src/lib/mcp/tools/tools.e2e.test.ts`: wszystkie narzędzia przez prawdziwego
  klienta MCP na bazie w pamięci (`fake-supabase.ts`);
- `src/lib/mcp/tools/tools.test.ts`: lista narzędzi i ich oznaczenia,
  walidacja przed bazą, wyliczanie dostępności;
- `src/lib/mcp/mcp.test.ts`: token, metadane, bezpieczny `next` po logowaniu;
- `src/lib/mcp/routes.test.ts`: odpowiedź `401` i oba adresy metadanych.

### Dodanie narzędzia

1. Dopisz narzędzie w odpowiednim pliku `src/lib/mcp/tools/` (opis po
   angielsku: co robi i kiedy go użyć; `readOnlyHint` / `destructiveHint`).
2. Jeśli to nowy plik, zarejestruj go w `src/lib/mcp/server.ts`.
3. Dopisz nazwę do listy w `tools.test.ts` i przypadki w `tools.e2e.test.ts`.
4. Zaktualizuj tabelę narzędzi w tym pliku i wpis w rejestrze narzędzi Rocksoft.

### Rozwiązywanie problemów

| Objaw | Przyczyna |
|---|---|
| Claude od razu odrzuca adres connectora | Metadane (`/api/mcp/oauth-protected-resource`) nie zwracają JSON-a albo mają zły `resource` (`NEXT_PUBLIC_SITE_URL`) |
| Ekran zgody: „Nie można przetworzyć żądania” | Wygasłe żądanie albo wyłączone Dynamic OAuth Apps; połącz ponownie |
| Po zalogowaniu Planner pokazuje Timeline zamiast zgody | Logowanie nie zaczęło się z ekranu zgody; połącz ponownie z Claude |
| Narzędzie zwraca „Brak uprawnień…” | RLS w bazie nie pozwala tej osobie na zmianę |
| Wszystkie narzędzia zwracają `401` | Token wygasł i odświeżenie się nie udało; połącz ponownie |

### Znane ograniczenia

- nginx na RunCloud blokuje `/.well-known/*` (403). Claude korzysta z adresu
  z nagłówka `401`, więc to nie przeszkadza. Klient, który szuka metadanych
  wyłącznie pod adresem `/.well-known`, nie połączy się, dopóki nginx nie
  przepuści `/.well-known/oauth-protected-resource` do Next.js.
- Token z Supabase nie jest przypisany wyłącznie do connectora: endpoint
  przyjmuje każdy ważny token użytkownika Plannera. Uprawnienia są i tak te
  same co w aplikacji.
- `allocations.person_id` ma w schemacie klucz do `profiles`, a aplikacja
  (i connector) wpisują tam id z `team_members`. Connector robi to samo co UI.
- Reguły RLS tabel `team_members` i `time_off` nie są zapisane w repo
  (zob. README). Connector polega na regułach z produkcyjnej bazy.
- Rejestracja nowego konta z ekranu logowania nie wraca na ekran zgody; po
  rejestracji trzeba połączyć connector jeszcze raz.
