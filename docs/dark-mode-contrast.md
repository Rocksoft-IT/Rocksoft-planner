# Kontrast motywów Plannera

Weryfikacja: 20.10.2026. Zakres: Timeline, People, Projects i Kompetencje.

## Paleta

`src/app/globals.css` definiuje osobne tokeny dla domyślnego dark mode i klasy
`.light`: tło, powierzchnie, tekst główny/pomocniczy, linie, obramowania kontrolek,
tło pasków dostępności i cztery stany dostępności.

Kolory zapisane w projektach pozostają identyfikatorami ich barwy.
`src/lib/colors.ts` wyprowadza z nich osobne, nieprzezroczyste pary tła i tekstu
oraz akcenty dla obu motywów. Algorytm uwzględnia również kolory spoza pickera.
Tekst projektu ma zapas ponad 4,5:1, a akcent ponad 3:1 względem wypełnienia
i otaczającej powierzchni. Wyliczenia są zapamiętywane według koloru, aby nie
powtarzać ich przy przewijaniu i przeciąganiu alokacji.

Każda alokacja ma tło na całą wysokość etykiety, również przy 1h/dzień.
Wysokość akcentu po lewej nadal wskazuje wymiar godzin. Tentative wyróżnia
przerywana ramka, znak zapytania i wzór przy dolnej krawędzi, poza tekstem.
Hover zachowuje pełną nieprzezroczystość. Badge umów korzystają z tych samych
reguł kontrastu. Inicjały awatarów pozostają białe w obu motywach; tło zachowuje
wybraną barwę i jest przyciemniane tylko w zakresie potrzebnym dla kontrastu.

Tekst dostępności i wypełnienia pasków mają osobne tokeny. Na prośbę użytkownika
light mode ponownie korzysta z poprzednich kolorów dostępności: `#10b981`
(wolny), `#f59e0b` (pełny / prawie pełny), `#ef4444` (przeciążony) i `#64748b`
(niedostępny). Dotyczy to etykiet i pasków w Timeline oraz People. Ta oryginalna
paleta dostępności light mode nie spełnia wszystkich progów AA; audyt nadal
raportuje jej niski kontrast. Gwarancja AA w testach tokenów nie obejmuje tych
kolorów. Osobne tokeny `--status-*` zachowują kontrast komunikatów błędów
i wyboru Confirmed/Tentative w formularzach. Dark mode pozostaje bez zmian.

Progi pochodzą z WCAG 2.1 AA:
[1.4.3 — kontrast tekstu](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
i [1.4.11 — kontrast elementów graficznych](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html).

## Powtarzanie audytu

```sh
npm ci
npx playwright install chromium
npm run audit:contrast
node scripts/audit-contrast.mjs --narrow
node scripts/audit-contrast.mjs --availability
npm test
npm run build
```

Opcjonalna zmienna `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` pozwala wskazać istniejącą
instalację Chromium. Raport JSON i zrzuty ekranu trafiają do
`test-results/contrast/` (katalog pomijany przez Git).

Audyt uruchamia prawdziwe komponenty aplikacji w Chromium przez Vite, z tym samym
globalnym CSS. Używa wyłącznie danych testowych i atrap Supabase/nawigacji Next;
nie odczytuje ani nie zapisuje danych użytkowników. Kontroluje regułę axe-core
`color-contrast`, dodatkowo mierzy kolory placeholderów, renderowanych pasków,
obramowań i siatki oraz sprawdza pełne tło etykiet i brak przecięcia tekstu
z kreskowaniem. Przełącza motyw w obie strony w każdym widoku, bez przeładowania.
Pomiary wykonuje po zakończeniu przejść kolorów i hover, dla ustalonego wyglądu.
Wariant `--narrow` zapisuje wyniki osobno w `test-results/contrast/narrow/`.

Przypadki obejmują całą paletę projektów, niestandardowy granat, biel i czerń,
wszystkie sześć typów umów, alokacje 1–10h, tentative, urlop oraz stany wolny,
częściowo wolny, pełny, przeciążony i niedostępny.

## Wynik przed przywróceniem palety dostępności light mode

60 scenariuszy obu motywów: 52 w rozdzielczości 1920 × 1200 i osiem
w rozdzielczości 1366 × 900.

| Widok / stan | Scenariuszy łącznie | Dark: błędy axe | Light: błędy axe |
| --- | ---: | ---: | ---: |
| Timeline, hover, filtry osób/projektów, menu miesięcy, formularze alokacji i nieobecności | 18 | 0 | 0 |
| People, grupowanie dostępności, formularz osoby | 6 | 0 | 0 |
| Projects i formularz projektu z całą paletą | 4 | 0 | 0 |
| Kompetencje: wyszukiwarka, wyniki, edytor, formularz doświadczenia | 8 | 0 | 0 |
| Przełączanie motywu w obie strony w każdym z czterech widoków | 16 | 0 | 0 |
| Cztery widoki na ekranie 1366 × 900 | 8 | 0 | 0 |

W Timeline axe oznacza 16 etykiet przyklejonej kolumny jako `incomplete`
(`elmPartiallyObscuring`). Dodatkowy pomiar ich rzeczywistych kolorów względem
nieprzezroczystej powierzchni daje minimum 9,90:1 w dark i 7,57:1 w light mode.
Nie są pomijane w dodatkowym sprawdzeniu progów. Analogicznie sprawdzana jest
etykieta pomocnicza formularza osoby, której tła axe również nie rozpoznaje.
Zrzuty wszystkich czterech widoków obu motywów i wybranych formularzy zostały
również obejrzane. Placeholdery w sprawdzonych stanach light mode osiągają
co najmniej 6,91:1.

W dark mode najmniejszy zmierzony kontrast sprawdzanych obramowań alokacji
i linii siatki wyniósł 3,75:1; dla wypełnienia paska dostępności względem jego
tła — 7,60:1. Kontrole pełnego tła i geometrii kreskowania przeszły.

Przegląd light mode objął również placeholdery, statusy Confirmed/Tentative,
komunikaty błędów, linki w stanie hover i wskaźnik wybranego motywu. Kolory
statusów korzystają z tokenów właściwych dla motywu. Dla dostępności przycisków
„OOO” i „Przydziel” pasek narzędzi Timeline rośnie przy zawijaniu na węższym
ekranie; audyt sprawdza, czy przyciski nie są zasłonięte przez siatkę.

Testy jednostkowe sprawdzają tokeny objęte progami AA w obu motywach oraz 232 kolory wejściowe
(paleta, barwy niestandardowe i siatka RGB), osobno dla obu motywów.
Łącznie przeszły 42 testy; build produkcyjny i TypeScript również przeszły.
Pełny lint nadal zgłasza cztery wcześniejsze błędy hooków i trzy ostrzeżenia
w istniejących komponentach; nowe pliki audytu i kolorów przechodzą lint.

## Regresja paska „Wolne 0h / 20h”

Status „pełny” ma wypełnienie na 100% szerokości mimo 0% wolnego czasu.
Kolor paska ma wartość zapasową na wypadek braku nowych tokenów kolorów;
komponent obsługuje również brak osobnej wartości `barColor`.
Test jednostkowy sprawdza dokładnie 20h alokacji przy 20h dostępnej pojemności.

Wariant `--availability` obejmuje osiem dodatkowych scenariuszy Timeline i People
w obu motywach, z normalnymi kolorami oraz z celowo wyłączonymi nowymi tokenami.
Sprawdza również rzeczywistą wysokość i szerokość wypełnienia, aby sam dobry
kontrast koloru nie maskował pustego paska. Wszystkie osiem przypadków przeszło
przed przywróceniem poprzedniej palety light mode. Aktualny raport i zrzuty
są w `test-results/contrast/availability/`; niski kontrast przywróconych kolorów
jest nadal raportowany, niezależnie od sprawdzenia geometrii pasków.

Po przywróceniu palety ponownie sprawdzono osiem scenariuszy dostępności.
Geometria wszystkich 120 pasków jest poprawna, w tym „Wolne 0h / 20h — pełny”
(147px wypełnienia na 147px tła w Timeline). Cztery scenariusze dark mode
nadal nie mają błędów kontrastu. W light mode axe raportuje niski kontrast
13 etykiet Timeline i 26 etykiet People; dodatkowy pomiar wskazuje po 11
wypełnień pasków poniżej 3:1. Te kolory nie są wykluczane z audytu.
Build produkcyjny, TypeScript i lint plików narzędziowych przeszły.
Testy kolorów, dostępności i parytetu typów umów przeszły (27 testów).
Pierwszy wspólny przebieg przekroczył limit 5s w jednym teście ThemeProvider;
powtórzenie całego pliku osobno zakończyło się wynikiem 15/15.

Wynik dotyczy kontrastu i opisanych stanów komponentów na danych testowych.
Nie stanowi audytu pozostałych kryteriów WCAG ani wszystkich możliwych układów
produkcyjnych danych i rozmiarów okna.
