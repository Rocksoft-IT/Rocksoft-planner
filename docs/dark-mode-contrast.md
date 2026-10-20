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
paleta dostępności light mode nie spełnia wszystkich progów AA.
Gwarancja AA w testach tokenów nie obejmuje tych
kolorów. Osobne tokeny `--status-*` zachowują kontrast komunikatów błędów
i wyboru Confirmed/Tentative w formularzach. Dark mode pozostaje bez zmian.

Progi pochodzą z WCAG 2.1 AA:
[1.4.3 — kontrast tekstu](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
i [1.4.11 — kontrast elementów graficznych](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html).

## Testy

`npm test` sprawdza między innymi kontrast tokenów objętych progami AA oraz
232 kolory wejściowe projektów i awatarów (paleta, barwy niestandardowe i siatka RGB).

Status „pełny” zachowuje pasek na 100% szerokości mimo 0% wolnego czasu.
Test dostępności obejmuje dokładnie 20h alokacji przy 20h dostępnej pojemności.
Kolor wypełnienia ma wartość zapasową na wypadek braku osobnego tokenu paska.
