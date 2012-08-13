// Copyright (c) 2012, Motorola Mobility, Inc.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//  * Redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//  * Redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//  * Neither the name of the Motorola Mobility, Inc. nor the names of its
//    contributors may be used to endorse or promote products derived from this
//    software without specific prior written permission.
//
//  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
// DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
// THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

#ifndef __JSON_INDICES_H__
#define __JSON_INDICES_H__

namespace JSONExport 
{
    class JSONIndices {
    private:
        JSONIndices();
        void _indicesCommonInit();
    public:
        JSONIndices(shared_ptr <JSONExport::JSONBuffer> buffer, size_t count, JSONExport::Semantic semantic, unsigned int indexOfSet);         
        JSONIndices(std::string accessorID, shared_ptr <JSONExport::JSONBuffer> buffer, size_t count, JSONExport::Semantic semantic, unsigned int indexOfSet);         
        virtual ~JSONIndices();
        
        size_t const getCount();
        JSONExport::Semantic const getSemantic();
        unsigned int const getIndexOfSet();
        const std::string getAccessorID();

        const shared_ptr <JSONBuffer> getBuffer();
        const void setBuffer(shared_ptr <JSONBuffer>);
        void setByteOffset(size_t byteOffset);
        size_t getByteOffset();
                
    private:
        std::string _accessorID;
        size_t _count;
        size_t _byteOffset;
        JSONExport::Semantic _semantic;
        unsigned int _indexOfSet;
        shared_ptr <JSONExport::JSONBuffer> _buffer;
    };

}


#endif
