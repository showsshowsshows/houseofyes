import Runscraper from "./components/run-scraper";
const fs = require("fs");
const puppeteer = require("puppeteer")


const endpoint: string = "https://www.houseofyes.org/";

interface Gig {
  title: string;
  date?: string;
  genre?: string;
  location?: string;
  time?: string;
  price?: string;
  image?: string;
  excerpt?: string;
  isFeatured: boolean;
  rating: number;
  expiresAt?: string;
}

interface HomeProps {
  searchParams: { runScraperButton?: boolean };
}

export default function Home({ searchParams }: HomeProps): JSX.Element {
  console.log(typeof searchParams)
  if(searchParams.runScraperButton) {
    runScraper();
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
    <Runscraper />
  </main>
  )
}

async function runScraper(): Promise<void> {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(endpoint, { waitUntil: 'networkidle0' });
  await page.waitForSelector('td.cal-ticket a', { timeout: 30000 });

  const eventLinks = await dynamicScrollAndCollectLinks(page, 'td.cal-ticket a');
  console.log(`Collected ${eventLinks.length} event links`);

  let gigs: Gig[] = [];

  for (const link of eventLinks) {
    const gigDetails = await scrapeEventDetails(page, link);
    if (gigDetails) gigs.push(gigDetails);
  }

  console.log(`Scraped ${gigs.length} event details`);
  await browser.close();

  if (gigs.length) {
    fs.writeFileSync('events.json', JSON.stringify(gigs, null, 2), 'utf-8');
    console.log('Data saved to events.json :)');
  } else {
    console.log('No data to save.');
  }
}

async function dynamicScrollAndCollectLinks(page: any, selector: string): Promise<string[]> {
  let links = new Set<string>();
  try {
    let previousSize = 0;
    let newSize = 0;
    do {
      previousSize = links.size;
      const newLinks = await page.$$eval(selector, (elements: Element[]) =>
      elements.map((element) => {
        // Assert the element type to HTMLAnchorElement
        const anchor = element as HTMLAnchorElement;
        return anchor.href;
      })
    );
      newLinks.forEach((link: string) => links.add(link));
      newSize = links.size;
      if (newSize > previousSize) {
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await page.waitForTimeout(2000); // Adjust this timeout as needed
      }
    } while (newSize > previousSize);
  } catch (error) {
    console.error('Error during dynamic scroll and link collection: ', error);
  }
  return Array.from(links);
}

async function scrapeEventDetails(page: any, link: string): Promise<Gig | null> {
  try {
    await page.goto(link, { waitUntil: 'networkidle0' });
    const title = await page.evaluate(() => {
      const titleElement = document.querySelector('.event-title.css-0, h1.event-title, .ng-binding.pointer');
      return titleElement ? titleElement.textContent?.trim() : 'Title Not Found';
    });
    const date = await page.$eval('.start-date', (el: Element) => el.getAttribute('datetime') || '');
    const expiresAt = calculateExpiresAt(date)
    const genre = await page.$eval('p[class="summary"] strong', (el: Element) => el.textContent?.trim() || '');
    const location = await page.$eval('.location-info__address-text', (el: Element) => el.textContent?.trim() || '');
    const time = await page.$eval('.date-info__full-datetime', (el: Element) => el.textContent?.trim() || '');
    const price = await page.$eval('.conversion-bar__panel-info', (el: Element) => el.textContent?.trim() || '');
    const image = await page.$eval('picture[data-testid="hero-image"] img', (img: Element) => img.getAttribute('src') || '');

    let excerpt = await page.evaluate((): string => {
      const descriptionElement = document.querySelector('.event-description__content--expanded');
      if (!descriptionElement) return '';
      let html = descriptionElement.innerHTML;
      html = html.replace(/<br\s*[\/]?>/gi, "\n");
      const div = document.createElement('div');
      div.innerHTML = html;
      return div.textContent || div.innerText || '';
    });

    return {
      title,
      date,
      genre,
      location,
      time,
      price,
      image,
      excerpt,
      isFeatured: false,
      rating: 0,
      expiresAt

    };
  } catch (error) {
    console.error(`Error scraping details from ${link}: `, error);
    return null;
  }
}

const calculateExpiresAt = (eventDate: any) => {
  const date = new Date(eventDate);

  date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCHours(2, 0, 0, 0); 

  let isoString = date.toISOString(); 
  return isoString;
};