const gulp = require('gulp'),
	cp = require('child_process'),
	glob = require('glob'),
	fs = require('fs'),
	path = require('path'),
	p = require('./package.json'),
	csv = require('csv-parser'),
	zip = require('gulp-zip'),
	svgo = require('gulp-svgo'),
	outlineStroke = require('svg-outline-stroke'),
	iconfont = require('gulp-iconfont'),
	template = require('lodash.template'),
	sass = require('node-sass'),
	cleanCSS = require('clean-css'),
	argv = require('minimist')(process.argv.slice(2)),
	svgr = require('@svgr/core').default

const compileOptions = {
	includeIcons: [],
	strokeWidth: null,
	fontForge: "fontforge"
}

if (fs.existsSync('./compile-options.json')) {
	try {
		const tempOptions = require('./compile-options.json')
		if (typeof tempOptions !== "object") {
			throw "Compile options file does not contain an json object"
		}

		if (typeof tempOptions.includeIcons !== "undefined") {
			if (!Array.isArray(tempOptions.includeIcons)) {
				throw "property inludeIcons is not an array"
			}
			compileOptions.includeIcons = tempOptions.includeIcons
		}

		if (typeof tempOptions.includeCategories !== "undefined") {
			if (typeof tempOptions.includeCategories === "string") {
				tempOptions.includeCategories = tempOptions.includeCategories.split(' ')
			}
			if (!Array.isArray(tempOptions.includeCategories)) {
				throw "property includeCategories is not an array or string"
			}
			const tags = Object.entries(require('./tags.json'))
			tempOptions.includeCategories.forEach(function (category) {
				category = category.charAt(0).toUpperCase() + category.slice(1)
				for (const [icon, data] of tags) {
					if (data.category === category && compileOptions.includeIcons.indexOf(icon) === -1) {
						compileOptions.includeIcons.push(icon)
					}
				}
			})
		}

		if (typeof tempOptions.excludeIcons !== "undefined") {
			if (!Array.isArray(tempOptions.excludeIcons)) {
				throw "property excludeIcons is not an array"
			}
			compileOptions.includeIcons = compileOptions.includeIcons.filter(function (icon) {
				return tempOptions.excludeIcons.indexOf(icon) === -1
			})
		}

		if (typeof tempOptions.excludeOffIcons !== "undefined" && tempOptions.excludeOffIcons) {
		    	// Exclude `*-off` icons
			compileOptions.includeIcons = compileOptions.includeIcons.filter(function (icon) {
				return !icon.endsWith('-off');
			})
		}

		if (typeof tempOptions.strokeWidth !== "undefined") {
			if (typeof tempOptions.strokeWidth !== "string" && typeof tempOptions.strokeWidth !== "number") {
				throw "property strokeWidth is not a string or number"
			}
			compileOptions.strokeWidth = tempOptions.strokeWidth.toString()
		}

		if (typeof tempOptions.fontForge !== "undefined") {
			if (typeof tempOptions.fontForge !== "string") {
				throw "property fontForge is not a string"
			}
			compileOptions.fontForge = tempOptions.fontForge
		}

	} catch (error) {
		throw `Error reading compile-options.json: ${error}`
	}

}



const svgToPng = async (filePath, destination) => {
	filePath = path.join(__dirname, filePath)

	await cp.exec(`rsvg-convert -h 240 ${filePath} > ${destination}`)
}

const createScreenshot = async (filePath) => {
	await cp.exec(`rsvg-convert -x 2 -y 2 ${filePath} > ${filePath.replace('.svg', '.png')}`)
	await cp.exec(`rsvg-convert -x 4 -y 4 ${filePath} > ${filePath.replace('.svg', '@2x.png')}`)
}

const printChangelog = function (newIcons, modifiedIcons, renamedIcons, pretty = false) {
	if (newIcons.length > 0) {
		if (pretty) {
			console.log(`### ${newIcons.length} new icons:`)

			newIcons.forEach(function (icon, i) {
				console.log(`- \`${icon}\``)
			})
		} else {
			let str = ''
			str += `${newIcons.length} new icons: `

			newIcons.forEach(function (icon, i) {
				str += `\`${icon}\``

				if ((i + 1) <= newIcons.length - 1) {
					str += ', '
				}
			})

			console.log(str)
		}

		console.log('')
	}

	if (modifiedIcons.length > 0) {
		let str = ''
		str += `Fixed icons: `

		modifiedIcons.forEach(function (icon, i) {
			str += `\`${icon}\``

			if ((i + 1) <= modifiedIcons.length - 1) {
				str += ', '
			}
		})

		console.log(str)
		console.log('')
	}

	if (renamedIcons.length > 0) {
		console.log(`Renamed icons: `)

		renamedIcons.forEach(function (icon, i) {
			console.log(`- \`${icon[0]}\` renamed to \`${icon[1]}\``)
		})
	}
}

const generateIconsPreview = function (files, destFile, cb, columnsCount = 19, paddingOuter = 7) {

	const padding = 20,
		iconSize = 24

	const iconsCount = files.length,
		rowsCount = Math.ceil(iconsCount / columnsCount),
		width = columnsCount * (iconSize + padding) + 2 * paddingOuter - padding,
		height = rowsCount * (iconSize + padding) + 2 * paddingOuter - padding

	let svgContentSymbols = '',
		svgContentIcons = '',
		x = paddingOuter,
		y = paddingOuter

	files.forEach(function (file, i) {
		let name = path.basename(file, '.svg')

		let svgFile = fs.readFileSync(file),
			svgFileContent = svgFile.toString()

		svgFileContent = svgFileContent
			.replace('<svg xmlns="http://www.w3.org/2000/svg"', `<symbol id="${name}"`)
			.replace(' width="24" height="24"', '')
			.replace('</svg>', '</symbol>')
			.replace(/\n\s+/g, '')

		svgContentSymbols += `\t${svgFileContent}\n`
		svgContentIcons += `\t<use xlink:href="#${name}" x="${x}" y="${y}" width="${iconSize}" height="${iconSize}" />\n`

		x += padding + iconSize

		if (i % columnsCount === columnsCount - 1) {
			x = paddingOuter
			y += padding + iconSize
		}
	})

	const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="color: #354052"><rect x="0" y="0" width="${width}" height="${height}" fill="#fff"></rect>\n${svgContentSymbols}\n${svgContentIcons}\n</svg>`

	fs.writeFileSync(destFile, svgContent)
	createScreenshot(destFile)

	cb()
}

//*********************************************************************************************

gulp.task('iconfont-prepare', function (cb) {
	cp.exec('mkdir -p icons-outlined/ && rm -fd ./icons-outlined/* && mkdir -p && rm -fd ./iconfont/*', function () {
		cb()
	})
})

gulp.task('iconfont-clean', function (cb) {
	cp.exec('rm -rf ./icons-outlined', function () {
		cb()
	})
})

gulp.task('iconfont-svg-outline', function (cb) {

	cp.exec('mkdir -p icons-outlined/ && rm -fd ./icons-outlined/*', async () => {
		let files = glob.sync("./icons/*.svg")

		let iconfontUnicode = {}

		if (fs.existsSync('./.build/iconfont-unicode.json')) {
			iconfontUnicode = require('./.build/iconfont-unicode')
		}

		await asyncForEach(files, async function (file) {

			const name = path.basename(file, '.svg')

			if (compileOptions.includeIcons.length === 0 || compileOptions.includeIcons.indexOf(name) >= 0) {

				unicode = iconfontUnicode[name]

				await console.log('Stroke for:', file, unicode)

				let strokedSVG = fs.readFileSync(file).toString()

				strokedSVG = strokedSVG
					.replace('width="24"', 'width="1000"')
					.replace('height="24"', 'height="1000"')

				if (compileOptions.strokeWidth) {
					strokedSVG = strokedSVG.replace('stroke-width="2"', `stroke-width="${compileOptions.strokeWidth}"`)
				}

				await outlineStroke(strokedSVG, {
					optCurve: false,
					steps: 4,
					round: 0,
					centerHorizontally: true,
					fixedWidth: true,
					color: 'black'
				}).then(outlined => {
					if (unicode) {
						fs.writeFileSync(`icons-outlined/u${unicode.toUpperCase()}-${name}.svg`, outlined)
					} else {
						fs.writeFileSync(`icons-outlined/${name}.svg`, outlined)
					}
				}).catch(error => console.log(error))
			}

		})

		cb()
	})
})

gulp.task('iconfont-optimize', function () {
	return gulp.src('icons-outlined/*')
		.pipe(svgo())
		.pipe(gulp.dest('icons-outlined'))
})

gulp.task('iconfont-fix-outline', function (cb) {
	var fontForge = compileOptions.fontForge

	// correct svg outline directions in a child process using fontforge
	const generate = cp.spawn(fontForge, ["-lang=py", "-script", "./fix-outline.py"], { stdio: 'inherit' })
	generate.on("close", function (code) {
		console.log(`Correcting svg outline directions exited with code ${code}`)
		if (!code) {
			cb()
		}
	})
})

gulp.task('iconfont', function () {
	let maxUnicode = 59905

	if (fs.existsSync('./.build/iconfont-unicode.json')) {
		const iconfontUnicode = require('./.build/iconfont-unicode')

		for (const name in iconfontUnicode) {
			const unicode = parseInt(iconfontUnicode[name], 16)

			maxUnicode = Math.max(maxUnicode, unicode)
		}
	}

	maxUnicode = maxUnicode + 1

	return gulp.src(['icons-outlined/*.svg'])
		.pipe(iconfont({
			fontName: 'tabler-icons',
			prependUnicode: true,
			formats: ['ttf', 'eot', 'woff', 'woff2', 'svg'],
			normalize: true,
			startUnicode: maxUnicode,
			fontHeight: 1000,
			descent: 100,
			ascent: 986.5
		}))
		.on('glyphs', function (glyphs, options) {
			//glyphs json
			let glyphsObject = {}

			//sort glypht
			glyphs = glyphs.sort(function (a, b) {
				return ('' + a.name).localeCompare(b.name)
			})

			glyphs.forEach(function (glyph) {
				glyphsObject[glyph.name] = glyph.unicode[0].codePointAt(0).toString(16)
			})

			fs.writeFileSync(`./.build/iconfont-unicode.json`, JSON.stringify(glyphsObject))

			//css
			options['glyphs'] = glyphs
			options['v'] = p.version

			const compiled = template(fs.readFileSync('.build/iconfont.scss').toString())
			const result = compiled(options)

			fs.writeFileSync('iconfont/tabler-icons.scss', result)

			//html
			const compiledHtml = template(fs.readFileSync('.build/iconfont.html').toString())
			const resultHtml = compiledHtml(options)

			fs.writeFileSync('iconfont/tabler-icons.html', resultHtml)
		})
		.pipe(gulp.dest('iconfont/fonts'))
})

gulp.task('iconfont-css', function (cb) {
	sass.render({
		file: 'iconfont/tabler-icons.scss',
		outputStyle: 'expanded'
	}, function (err, result) {
		fs.writeFileSync('iconfont/tabler-icons.css', result.css)

		const cleanOutput = new cleanCSS({}).minify(result.css)
		fs.writeFileSync('iconfont/tabler-icons.min.css', cleanOutput.styles)

		cb()
	})
})

gulp.task('update-tags-unicode', function (cb) {
	let tags = require('./tags.json'),
		unicodes = require('./.build/iconfont-unicode.json')

	for (let i in tags) {
		tags[i] = {
			...tags[i],
			unicode: unicodes[i],
		}
	}

	console.log('tags', tags)

	fs.writeFileSync(`tags.json`, JSON.stringify(tags, null, 2))

	cb()
})

gulp.task('build-iconfont', gulp.series('iconfont-prepare', 'iconfont-svg-outline', 'iconfont-fix-outline', 'iconfont-optimize', 'iconfont', 'iconfont-css', 'iconfont-clean', 'update-tags-unicode'))

gulp.task('build-zip', function () {
	const version = p.version

	return gulp.src('{icons/**/*,icons-png/**/*,icons-react/**/*,iconfont/**/*,tabler-sprite.svg,tabler-sprite-nostroke.svg}')
		.pipe(zip(`tabler-icons-${version}.zip`))
		.pipe(gulp.dest('packages-zip'))
})

gulp.task('build-jekyll', function (cb) {
	const jekyll = cp.spawn("bundle", ["exec", "jekyll", "build"], { stdio: 'inherit' })
	jekyll.on("close", function (code) {
		console.log(`Jekyll build exited with code ${code}`)
		if (!code) {
			cb()
		}
	})
})

gulp.task('build-copy', function (cb) {
	cp.exec('mkdir -p icons/ && rm -fd ./icons/* && cp ./_site/icons/* ./icons && cp ./_site/tags.json .', function () {
		cb()
	})
})

gulp.task('clean-png', function (cb) {
	cp.exec('rm -fd ./icons-png/*', function () {
		cb()
	})
})

gulp.task('icons-sprite', function (cb) {
	glob("_site/icons/*.svg", {}, function (er, files) {

		let svgContent = ''

		files.forEach(function (file, i) {
			let name = path.basename(file, '.svg'),
				svgFile = fs.readFileSync(file),
				svgFileContent = svgFile.toString()

			svgFileContent = svgFileContent
				.replace(/<svg[^>]+>/g, '')
				.replace(/<\/svg>/g, '')
				.replace(/\n+/g, '')
				.replace(/>\s+</g, '><')
				.trim()

			svgContent += `<symbol id="tabler-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgFileContent}</symbol>`
		})

		let svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs>${svgContent}</defs></svg>`

		fs.writeFileSync('tabler-sprite.svg', svg)
		fs.writeFileSync('tabler-sprite-nostroke.svg', svg.replace(/stroke-width="2"\s/g, ''))
		cb()
	})
})

gulp.task('icons-preview', function (cb) {
	glob("icons/*.svg", {}, function (er, files) {
		generateIconsPreview(files, '.github/icons.svg', cb)
	})
})

gulp.task('icons-stroke', gulp.series('build-jekyll', function (cb) {

	const icon = "disabled",
		strokes = ['.5', '1', '1.5', '2', '2.75'],
		svgFileContent = fs.readFileSync(`icons/${icon}.svg`).toString(),
		padding = 16,
		paddingOuter = 3,
		iconSize = 32,
		width = 914,
		height = iconSize + paddingOuter * 2

	let svgContentSymbols = '',
		svgContentIcons = '',
		x = paddingOuter

	strokes.forEach(function (stroke) {
		let svgFileContentStroked = svgFileContent
			.replace('<svg xmlns="http://www.w3.org/2000/svg"', `<symbol id="icon-${stroke}"`)
			.replace(' width="24" height="24"', '')
			.replace(' stroke-width="2"', ` stroke-width="${stroke}"`)
			.replace('</svg>', '</symbol>')
			.replace(/\n\s+/g, '')

		svgContentSymbols += `\t${svgFileContentStroked}\n`
		svgContentIcons += `\t<use xlink:href="#icon-${stroke}" x="${x}" y="${paddingOuter}" width="${iconSize}" height="${iconSize}" />\n`

		x += padding + iconSize
	})

	const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="color: #354052"><rect x="0" y="0" width="${width}" height="${height}" fill="#fff"></rect>\n${svgContentSymbols}\n${svgContentIcons}\n</svg>`

	fs.writeFileSync('.github/icons-stroke.svg', svgContent)
	createScreenshot('.github/icons-stroke.svg')
	cb()
}))

gulp.task('optimize', function (cb) {

})

gulp.task('changelog-commit', function (cb) {
	cp.exec('git status', function (err, ret) {
		let newIcons = [], modifiedIcons = [], renamedIcons = []

		ret.replace(/new file:\s+src\/_icons\/([a-z0-9-]+)\.svg/g, function (m, fileName) {
			newIcons.push(fileName)
		})

		ret.replace(/modified:\s+src\/_icons\/([a-z0-9-]+)\.svg/g, function (m, fileName) {
			modifiedIcons.push(fileName)
		})

		ret.replace(/renamed:\s+src\/_icons\/([a-z0-9-]+).svg -> src\/_icons\/([a-z0-9-]+).svg/g, function (m, fileNameBefore, fileNameAfter) {
			renamedIcons.push([fileNameBefore, fileNameAfter])
		})

		modifiedIcons = modifiedIcons.filter(function (el) {
			return newIcons.indexOf(el) < 0
		})

		printChangelog(newIcons, modifiedIcons, renamedIcons)

		cb()
	})
})

gulp.task('changelog', function (cb) {
	const version = argv['latest-tag'] || `v${p.version}`

	if (version) {
		cp.exec(`git diff ${version} HEAD --name-status`, function (err, ret) {

			let newIcons = [], modifiedIcons = [], renamedIcons = []

			ret.replace(/A\s+src\/_icons\/([a-z0-9-]+)\.svg/g, function (m, fileName) {
				newIcons.push(fileName)
			})

			ret.replace(/M\s+src\/_icons\/([a-z0-9-]+)\.svg/g, function (m, fileName) {
				modifiedIcons.push(fileName)
			})

			ret.replace(/R[0-9]+\s+src\/_icons\/([a-z0-9-]+)\.svg\s+src\/_icons\/([a-z0-9-]+).svg/g, function (m, fileNameBefore, fileNameAfter) {
				renamedIcons.push([fileNameBefore, fileNameAfter])
			})

			modifiedIcons = modifiedIcons.filter(function (el) {
				return newIcons.indexOf(el) < 0
			})

			printChangelog(newIcons, modifiedIcons, renamedIcons, true)

			cb()
		})
	}
})

gulp.task('changelog-image', function (cb) {
	const version = argv['latest-version'] || `${p.version}`,
		newVersion = argv['new-version'] || `${p.version}`

	if (version) {
		cp.exec(`git diff v${version} HEAD --name-status`, function (err, ret) {

			let newIcons = []

			ret.replace(/[A]\s+src\/_icons\/([a-z0-9-]+)\.svg/g, function (m, fileName) {
				newIcons.push(fileName)
			})

			newIcons = newIcons.map(function (icon) {
				return `./icons/${icon}.svg`
			})

			if (newIcons.length > 0) {
				generateIconsPreview(newIcons, `.github/tabler-icons-${newVersion}.svg`, cb, 6, 24)
			} else {
				cb()
			}
		})
	} else {
		cb()
	}
})

gulp.task('svg-to-png', gulp.series('build-jekyll', 'clean-png', async (cb) => {
	let files = glob.sync("./icons/*.svg")

	await asyncForEach(files, async function (file, i) {
		let name = path.basename(file, '.svg')

		console.log('name', name)

		await svgToPng(file, `icons-png/${name}.png`)
	})

	cb()
}))

gulp.task('clean-react', function (cb) {
	cp.exec('rm -fd ./icons-react/* && mkdir icons-react/icons-js', function () {
		cb()
	})
})

gulp.task('svg-to-react', gulp.series('clean-react', async function (cb) {


	cb()
}))


gulp.task('update-icons-version', function (cb) {


	cb()
})

gulp.task('import-tags', function (cb) {
	fs.createReadStream('./_import.csv')
		.pipe(csv({
			headers: false,
			separator: "\t"
		}))
		.on('data', (row) => {
			console.log(row[0], row[1])

			const filename = `src/_icons/${row[0]}.svg`

			let data = fs.readFileSync(filename).toString()
			data = data.replace(/(---[\s\S]+?---)/, function (m, headerContent) {

				headerContent = headerContent.replace(/tags: .*\n/, '')
				headerContent = headerContent.replace(/---/, `---\ntags: [${row[1]}]`)

				return headerContent
			})

			fs.writeFileSync(filename, data)

		})
		.on('end', () => {
			console.log('CSV file successfully processed')
		})
	cb()
})

gulp.task("build-react", function (cb) {
	cp.exec("npm run build-react", function () {
		cb()
	})
})

gulp.task('build', gulp.series('optimize', 'update-icons-version', 'build-jekyll', 'build-copy', 'icons-sprite', 'svg-to-react', 'build-react', 'icons-preview', 'svg-to-png', 'build-iconfont', 'changelog-image', 'build-zip'))
