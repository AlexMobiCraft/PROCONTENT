const testimonials = [
  {
    id: '1',
    text: [
      'Navdusena res. Ker delam za stranke tok odlasam s svojim profilom, ceprav bi ga res rada spravla v red, tko da se ful veselim se vec novega znanja. Skoraj sem ze vse predelala danes 😍 edino do chata se ne morem dostopat, bom vesela ce lahko ob priliki pogledas 🤍',
    ],
  },
  {
    id: '2',
    text: [
      'Draga Milena, ravnokar sem se včlanila v tvoj ProContent channel. Glihkar sem začela scrollat po vseh objavah in sem že zdaj navdušena koliko uporabne vsebine deliš 😍 Se fuuul veselim, da osvojim vse uporabne trikce in nadgradim svoje znanje in profil ✨',
    ],
  },
  {
    id: '3',
    text: [
      'Sicer ne bi smela, ampak morem pokazat screenshot kako zgleda v kanalu!',
      'Kako huda in poučna objava?! Noro. Prisežem, da zmeraj, ko dobim notification, da je nova vsebina sem res tolko hepi in grem takooooj prav z veseljem prebrat.',
      'Poleg tega pa imamo vse udeleženke še skupni chat, kjer si delimo ideje in mnenja, izkušnje, dodatne tips&tricks, sprašujemo podvprašanja itd...',
      'Torej ni samo vsebina ki jo dobimo ampak tudi cmmunity je tu toooolk sweett!! ✨',
    ],
  },
  {
    id: '4',
    text: [
      'Milena, js ti morem tole napisat🙈 mene je tak firbec matral, kaj bom v tem chatu dozivela in morem rect da sem ostala brez besed, pac to je to, kar sem iskala 😍 tako lepo, estetsko, jedrnato, kljucno povedano, res kapo dol!!',
      'Letos sem v porodniski in imam cas raziskovat, se ucit nove stvari in sem letos ze placala en kr drag tecaj, ki pa je bolj za zacetnike in mi je bilo na koncu tega denarja, res zal, ker ni bilo to par brunchev 🥲 in na koncu se nisem nic novega naucila..',
      'Tole je pa res next level in vesela sem, da sem te zacela spremljat, ker je tvoj content res wow, ustvarjaj se naprej, ker si res dobra na tej svoji poti!! ✨💖',
    ],
  },
]

export function TestimonialsSection() {
  return (
    <section className="bg-background px-5 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-2">
          <p className="text-xs font-medium tracking-[0.3em] uppercase text-primary">
            Mnenja
          </p>
          <h2 className="font-serif text-foreground text-balance text-[clamp(2rem,8vw,3.5rem)] font-light leading-none uppercase">
            Kaj pravijo
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {testimonials.map((testimonial) => (
            <blockquote
              key={testimonial.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4">
                <div className="space-y-3">
                  {testimonial.text.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-base leading-relaxed text-foreground"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
                <footer className="text-xs font-medium tracking-[0.15em] uppercase text-muted-foreground">
                  Resnično mnenje članice
                </footer>
              </div>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}
