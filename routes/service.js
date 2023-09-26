import express from 'express'
import axios from 'axios'
import cheerio from 'cheerio'
import admZip from 'adm-zip'
import {Readable} from 'stream'

const router = express.Router()

const siteUrl = 'https://www.opensubtitles.org'

// Search movie subtitle
router.get('/api/search/movie/:lang/:movieName', getMovie)
// Read movie subtitle
router.get('/api/:movieName/:lang/:totLink/:num/readMovieSubtitle', readMovieSubtitle)
// Search tv show subtitle
router.get('/api/search/show/:lang/:showName', getShow)
// Read show subtitle
router.get('/api/:showName/:season/:episode/:lang/:totLink/:num/readShowSubtitle', readShowSubtitle)

async function readShowSubtitle(req,res) {
  const paramLang =  req.params.lang // req.query.lang.split('.')[0]
  const listData = req.query.listData
  const season = req.params.season
  const episode = req.params.episode
  try {
      if(paramLang) {
          const totalLink = req.params.totLink
          let showName = req.params.showName.split('-').join('+')
          if(season && episode) {
            showName = `"${showName}"` + `+[S0${season}E0${episode}]`
          }
          const showId = await getId(showName,paramLang);
          const showData = await getEpisodeSubtitleInfo(showId,paramLang,totalLink) 
          if(listData) {
            res.json(showData)
            return
          }
          const linkNum = showData.length <= req.params.num ? showData.length - 1 : req.params.num  
          const url = showData[linkNum] ? showData[linkNum].downloadLink.split('-')[1]  : showData[linkNum-1].downloadLink.split('-')[1] 

          const options =  { 
              method: 'GET',
              url,
              responseType: "arraybuffer"
          };
          const { data } = await axios(options);
          const zip = new admZip(data)
          const entries = zip.getEntries() 
          let srtFileStream = null 
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  
          for (const entry of entries) {
            if (entry.entryName.endsWith('.srt') || entry.entryName.endsWith('.ass') || entry.entryName.endsWith('.vtt')) { 
              const buffer = entry.getData() 
              srtFileStream = Readable.from(buffer.toString('utf-8'))
              break
            }
          } 
          
          if(srtFileStream) {
              srtFileStream.pipe(res)
          } else {
              res.status(404).send('SRT file not found in the zip archive.')
          }
      } else {
          res.status(404).send('No subtitle found in this language!')
      }
      
  } catch (err) {
      console.log(err)
      res.status(500).send('Internal server error');
  }
}

async function readMovieSubtitle(req,res) {
  const paramLang =  req.params.lang //req.query.lang.split('.')[0]
  try {
      if(paramLang) {
          const totalLink = req.params.totLink
          const movieName = req.params.movieName;
          const movieId = await getId(movieName,paramLang);
          const movieData = await getSubtitleInfo(movieId,paramLang,totalLink) 
          const linkNum = movieData.links.length <= req.params.num ? movieData.links.length - 1 : req.params.num  
          const url = movieData.links ? movieData.links[linkNum].downloadLink.split('-')[1] : movieData.links[linkNum - 1].downloadLink.split('-')[1]
          const options =  { 
              method: 'GET',
              url,
              responseType: "arraybuffer"
          };
          const { data } = await axios(options);
          const zip = new admZip(data)
          const entries = zip.getEntries() 
          let srtFileStream = null 
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  
          for (const entry of entries) {
            if (entry.entryName.endsWith('.srt') || entry.entryName.endsWith('.ass') || entry.entryName.endsWith('.vtt')) { 
              const buffer = entry.getData() 
              srtFileStream = Readable.from(buffer.toString('utf-8'))
              break
            }
          } 
          
          if(srtFileStream) {
              srtFileStream.pipe(res)
          } else {
              res.status(404).send('SRT file not found in the zip archive.')
          }
      } else {
          res.status(404).send('No subtitle found in this language!')
      }
      
  } catch (err) {
      console.log(err)
      res.status(500).send('Internal server error');
  }
}

async function getMovie (req, res) { 
    // @param url: api/search/movie/tur/Moviename
    // @param queries: totalLink=number
    // @param language: use comma for multiple language

    let queryTotalLink = req.query.totalLink
    if(!queryTotalLink) {
        queryTotalLink = 3
    } 
    try {
      const paramLang = req.params.lang
      const movieName = req.params.movieName;
      const movieId = await getId(movieName,paramLang);
      if (!movieId) {
        throw new Error('Movie not found');
      }
      
      const subtitleInfo = await getSubtitleInfo(movieId,paramLang,queryTotalLink); 
      res.json(subtitleInfo);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
}

async function getShow (req, res) { 
    // @param url: api/search/show/tur/Showname
    // @param language: use comma for multiple language
  try {
    const paramLang = req.params.lang
    const showName = req.params.showName;
    const showId = await getId(showName,paramLang);
    if (!showId) {
      throw new Error('Movie not found');
    }
    
    const subtitleInfo = await getSubtitleInfo(showId,paramLang); 
    res.json(subtitleInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getId(mediaName,lang,type) {
    const searchUrl = `https://www.opensubtitles.org/en/search2/moviename-${mediaName}/sublanguageid-all`;
    try {
      
      const searchResponse = await axios.get(searchUrl);
      const $ = cheerio.load(searchResponse.data);
      const mediaLink = $('.bnone').attr('href');  
      if (!mediaLink) {
        return null;
      }

      const mediaId = mediaLink.match(/\/idmovie-(\d+)/);
      if (!mediaId || mediaId.length < 2) {
        return null;
      }
      
      return mediaId[1];
    } catch (error) {
      throw new Error('Movie search failed');
    }
}
  
async function getEpisodeSubtitleInfo (mediaId,lang,totalLink) {
    const searchUrl = `https://www.opensubtitles.org/en/search/sublanguageid-${lang}/idmovie-${mediaId}`
    try {
      const episodeResponse = await axios.get(searchUrl).catch(err => err)
      const $ = cheerio.load(episodeResponse.data)   
      let dwLinksEpisodes = []  
      const allLinks = $('.bnone').each((i, element) => {
        dwLinksEpisodes.push(siteUrl + element.attribs.href) 
      });  
      // Checking links
      let checkedLinks = await Promise.all(dwLinksEpisodes.map(async (item) => {
        const subtitleResponse = await axios.get(item).catch(err => err) 
        if(subtitleResponse.status === 200) { 
          return item
        } 
      }))

      let filteredLinks = checkedLinks.filter(item => item !== undefined)

      dwLinksEpisodes = filteredLinks

      let links = await Promise.all(dwLinksEpisodes.slice(0,totalLink).map(async (dwLink,index) => {
        return await getDownloadLink(dwLink,lang,'show')
      }))   
      return links
    } catch(err) {
      console.log(`Couldn't find subtitle, ${err}`)
    }
}

async function getSubtitleInfo(mediaId,lang,totalLink,type) {
    const searchUrl = `https://www.opensubtitles.org/en/search/sublanguageid-${lang}/idmovie-${mediaId}`
    try {
      const movieResponse = await axios.get(searchUrl)
      const $ = cheerio.load(movieResponse.data)  
      const singleLink = $('#bt-dwl-bt').attr('href')
      let mediaDesc
      const textH1 = $('.msg h1').text().trim().split(' ')
      let name = lang.split(',').length > 1 ? textH1.slice(0,index).join(' ') : textH1.slice(0,-1).join(' ') 
      let language = lang.split(',').length > 1 ? textH1.slice(index+1).join(' ') : textH1.slice(-1).join(' ')
      let links    

      if(!singleLink) {
        let downloadPageLinks = [] 
        mediaDesc = ($('fieldset p')[0].children[1].data).replace(/^\\|"|"\.$/g, '').replace(/^\s+|\s+$|\n/g, '')
        let episodePages = {}
        const index =  textH1.indexOf('subtitles')
  
        const findLinks = $('.bnone').each((index,element) => {
          downloadPageLinks.push(siteUrl + element.attribs.href)
        }); 
  
        if (downloadPageLinks.length < 1) {
            let currentSeason = null; 
            let dwLinksEpisodes = []
            language =  lang.split(',').length > 1 ? textH1.slice(-index+1,-1).join('') : textH1.slice(-2)[0]
            name = lang.split(',').length > 1 ? textH1.slice(0,lang.split(',').length).join(' ') : textH1.slice(0,-1).join(' ') 
            const allLinks = $('td a[itemprop="url"]').each(async (i, element) => {
              const href = element.attribs.href;
              const seasonMatch = href.match(/season-(\d+)/); 
              if (seasonMatch) {
                const seasonNumber = seasonMatch[1];
                currentSeason = `season-${seasonNumber}`;
                episodePages[currentSeason] = [];
              } else if (currentSeason) {
                episodePages[currentSeason].push(siteUrl + href); 
                dwLinksEpisodes.push(siteUrl + href)
              }
            });  
            links = episodePages
          } else {
            const subtitleTitle = $('#search_results tr td')
  
            links = await Promise.all(downloadPageLinks.slice(0,totalLink).map(async (dwLink,index) => {
              const id = dwLink.match(/\/subtitles\/(\d+)\//)[1] // regex for extract id
              const regex = /(\w+\.\d+\.\w+(\.\w+)?\.\w+(-\w+)?)\b/g // regex for extract for subtitle title
              const titleData = $(`#main${id}`)
              const subtitleTitle = titleData.text().trim().split(' ')[0].match(regex) ? titleData.text().trim().split(' ')[0].match(regex)[0] : name
              const data = await getDownloadLink(dwLink,lang)
              data['title'] = subtitleTitle
              const {downloadLink,title} = data 
              const sortedObj = {title, downloadLink}
              return sortedObj
            }))
        }
      } else {
        const downloadLink = `${lang}-` + siteUrl + singleLink 
        links = [{name,downloadLink}]
      }
      return { name,pageLink:searchUrl,desc:mediaDesc,language, links};
      
        
    } catch (error) {  
      console.log(error)
      throw new Error('Failed to fetch movie page')
    }
}

async function getDownloadLink(subtitlePageLink,lang,type) {  
      const subtitleResponse = await axios.get(subtitlePageLink).catch(err => err) 
       
        const $ = cheerio.load(subtitleResponse.data)   
        const langShort = {
            en: 'eng',
            abk: 'abk',
            afr: 'afr',
            sq: 'alb',
            ar: 'ara',
            arg: 'arg',
            arm: 'arm',
            asm: 'asm',
            ast: 'ast',
            az: 'aze',
            baq: 'baq',
            bel: 'bel',
            bn: 'ben',
            bs: 'bos',
            bre: 'bre',
            bg: 'bul',
            bur: 'bur',
            ca: 'cat',
            zh: 'chi',
            zt: 'zht',
            zhe: 'zhe',
            hr: 'hrv',
            cs: 'cze',
            da: 'dan',
            prs: 'prs',
            nl: 'dut',
            eng: 'eng',
            epo: 'epo',
            et: 'est',
            ext: 'ext',
            fi: 'fin',
            fr: 'fre',
            gla: 'gla',
            glg: 'glg',
            geo: 'geo',
            de: 'ger',
            el: 'ell',
            he: 'heb',
            hin: 'hin',
            hu: 'hun',
            ice: 'ice',
            ibo: 'ibo',
            id: 'ind',
            ina: 'ina',
            gle: 'gle',
            it: 'ita',
            ja: 'jpn',
            kan: 'kan',
            kaz: 'kaz',
            khm: 'khm',
            ko: 'kor',
            kur: 'kur',
            lav: 'lav',
            lit: 'lit',
            ltz: 'ltz',
            mk: 'mac',
            ms: 'may',
            mal: 'mal',
            mni: 'mni',
            mar: 'mar',
            mon: 'mon',
            mne: 'mne',
            nav: 'nav',
            nep: 'nep',
            sme: 'sme',
            no: 'nor',
            oci: 'oci',
            ori: 'ori',
            fa: 'per',
            pl: 'pol',
            pt: 'pot',
            pb: 'pob',
            pom: 'pom',
            pus: 'pus',
            ro: 'rum',
            ru: 'rus',
            sat: 'sat',
            sr: 'scc',
            snd: 'snd',
            sin: 'sin',
            slo: 'slo',
            slv: 'slv',
            som: 'som',
            es: 'spa',
            spn: 'spn',
            spl: 'spl',
            swa: 'swa',
            sv: 'swe',
            syr: 'syr',
            tgl: 'tgl',
            tam: 'tam',
            tat: 'tat',
            tel: 'tel',
            th: 'tha',
            tok: 'tok',
            tr: 'tur',
            tuk: 'tuk',
            uk: 'ukr',
            ur: 'urd',
            vi: 'vie',
            wel: 'wel'
        }
          
        const slug = subtitlePageLink.split('-')
        const slugLang = slug[slug.length - 1] 

        let downloadLink = `${langShort[slugLang]}-` + siteUrl + $('#bt-dwl-bt').attr('href');  
        if (!downloadLink) {
          throw new Error('Download link not found');
        } 
        return {downloadLink};   
}

export default router