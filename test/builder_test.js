var test = require('tap').test
var broccoli = require('..')
var Builder = broccoli.Builder
var RSVP = require('rsvp')
var Promise = RSVP.Promise

RSVP.on('error', function(error) {
  throw error
})

function countingTree (readFn) {
  return {
    read: function (readTree) {
      this.readCount++
      return readFn.call(this, readTree)
    },
    readCount: 0,
    cleanup: function () { this.cleanupCount++ },
    cleanupCount: 0
  }
}


test('Builder', function (t) {
  test('core functionality', function (t) {
    t.end()

    test('build', function (t) {
      test('passes through string tree', function (t) {
        var builder = new Builder('someDir')
        builder.build().then(function (blah) {
          t.equal(blah.directory, 'someDir')
          t.end()
        })
      })

      test('calls read on the provided tree object', function (t) {
        var builder = new Builder({
          read: function (readTree) { return 'someDir' }
        })
        builder.build().then(function (blah) {
          t.equal(blah.directory, 'someDir')
          t.end()
        })
      })

      t.end()
    })

    test('readTree deduplicates', function (t) {
      var subtree = new countingTree(function (readTree) { return 'foo' })
      var builder = new Builder({
        read: function (readTree) {
          return readTree(subtree).then(function (blah) {
            var dirPromise = readTree(subtree) // read subtree again
            t.ok(dirPromise.then, 'is promise, not string')
            return dirPromise
          })
        }
      })
      builder.build().then(function (blah) {
        t.equal(blah.directory, 'foo')
        t.equal(subtree.readCount, 1)
        t.end()
      })
    })

    test('cleanup', function (t) {
      test('is called on all trees called ever', function (t) {
        var tree = countingTree(function (readTree) {
          // Interesting edge case: Read subtree1 on the first read, subtree2 on
          // the second
          return readTree(this.readCount === 1 ? subtree1 : subtree2)
        })
        var subtree1 = countingTree(function (readTree) { return 'foo' })
        var subtree2 = countingTree(function (readTree) { throw new Error('bar') })
        var builder = new Builder(tree)
        builder.build().then(function (blah) {
          t.equal(blah.directory, 'foo')
          builder.build().catch(function (err) {
            t.equal(err.message, 'bar')
            builder.cleanup()
            t.equal(tree.cleanupCount, 1)
            t.equal(subtree1.cleanupCount, 1)
            t.equal(subtree2.cleanupCount, 1)
            t.end()
          })
        })
      })

      t.end()
    })
  })

  test('Tree Graph', function (t) {
    var parent = countingTree(function (readTree) {
      return readTree(child).then(function (dir) {
        return new Promise(function (resolve, reject) {
          setTimeout(function() { resolve('parentTreeDir') }, 50)
        })
      })
    })

    var child = countingTree(function (readTree) {
      return readTree('srcDir').then(function (dir) {
        return new Promise(function (resolve, reject) {
          setTimeout(function() { resolve('childTreeDir') }, 80)
        })
      })
    })

    var builder = new Builder(parent)
    builder.build().then(function (blah) {
      t.equal(blah.directory, 'parentTreeDir')
      console.error(blah.graph)
      t.end()
    })
  })

  t.end()
})
