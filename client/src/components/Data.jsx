import { useState, useEffect, useContext } from 'react'
import { contractAddress, contractABI } from '../constants'
import { ethers } from 'ethers'
import { AiOutlineCopy } from 'react-icons/ai'
import { IoOpenOutline } from 'react-icons/io5'

import axios from 'axios'
import FormData from 'form-data'

import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

function Data() {
    const [state, setState] = useState({
        provider: null,
        signer: null,
        contract: null,
    })
    // const { state: s, setProvider } = useContext(Context)
    // console.log({ state: s })
    const [connected, setConnected] = useState(false)
    const [cid, setCid] = useState('')
    const [signature, setSignature] = useState('')
    const [page, setPage] = useState('sign')
    const [account, setAccount] = useState('')
    const [showSignerInput, setShowSignerInput] = useState(false)
    const [signedTxData, setSignedTxData] = useState([])
    const [receivedTxData, setReceivedTxData] = useState([])
    const [selectedTx, setSelectedTx] = useState(null);

    const closeModal = () => setSelectedTx(null);

    const connectWallet = async () => {
        try {
            if (window.ethereum) {
                const accounts = await window.ethereum.request({
                    method: 'eth_requestAccounts',
                })
                // switching to correct network
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0xaa36a7' }], // chainId must be in hexadecimal
                })
                setAccount(accounts[0])

                const provider = new ethers.providers.Web3Provider(
                    window.ethereum
                )
                const signer = provider.getSigner()
                const contract = new ethers.Contract(
                    contractAddress,
                    contractABI,
                    signer
                )
                setState({ provider, signer, contract })
                console.log('connected accounts', accounts)
                document.getElementById('connect_button').innerHTML =
                    'connected'
                setConnected(true)
            } else {
                alert('Please install metamask')
            }
        } catch (error) {
            console.log(error)
        }
    }

    async function uploadImg() {
        console.log('upppload image calllled')

        const formData = new FormData()
        const file = document.getElementById('file').files[0]

        console.log('file is : ', file)
        if (!file) {
            console.log('file not uploaded')
            toast.error('please select the certificate first!', {
                position: 'top-right',
                autoClose: 3000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: 'light',
            })
            return
        }
        formData.append('file', file)
        console.log(formData)

        console.log('new pinata ipfs added')
        toast('Uploading...please wait', {
            position: "top-right",
            autoClose: 7000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "light",
            });

        const response = await axios.post(
            'https://api.pinata.cloud/pinning/pinFileToIPFS',
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    pinata_api_key: import.meta.env.VITE_PINATA_API_KEY,
                    pinata_secret_api_key: import.meta.env
                        .VITE_PINATA_SECRET_API_KEY,
                },
            }
        )
        console.log('ipfs hash generated!')
        console.log(response.data.IpfsHash)
        setCid(response.data.IpfsHash)
        console.log('Content added with CID:', cid)
    }

    async function getSignature() {
        if (!cid) {
            console.log('cid is', cid)
            console.log('toastify error')
            toast.error('please upload the certificate to IPFS first!', {
                position: 'top-right',
                autoClose: 3000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: 'light',
            })
            return
        }
        const packedMessage = ethers.utils.solidityPack(['string'], [cid])
        console.log('packed msg: ', packedMessage)
        const hash = ethers.utils.keccak256(packedMessage)

        const res = await window.ethereum.request({
            method: 'personal_sign',
            params: [account, hash],
        })
        console.log('signature:', res)
        setSignature(res)
    }

    async function checkValidity() {
        let signingAuthority = document.querySelector('#signer').value
        if (signingAuthority[0] === '"') {
            signingAuthority = signingAuthority.substring(
                1,
                signingAuthority.length - 1
            )
        }
        const msg = document.querySelector('#msg').value
        const signature = document.querySelector('#signature').value
        const valid = await state.contract.verify(
            signingAuthority,
            msg,
            signature
        )
        console.log('signature is', valid)
        document.querySelector('#valid').innerHTML = `<h1>${valid}</h1>`
    }

    async function saveData() {
        const receiver = document.querySelector('#receiver').value
        const message = document.querySelector('#message').value

        console.log(receiver, message, cid)
        console.log(signature)
        console.log(account)

        console.log('sendign transactoin...')

        toast.info('Transaction submitted to the blockchain!', {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "light",
            });

        const saved = await state.contract.storeSignature(
            account,
            receiver,
            cid.toString(),
            signature,
            message
        )
        await saved.wait()
        toast.success('data successfully stored in blockchain! Check the data section', {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "light",
            });
        console.log('saveData ', saved)
    }

    async function setSenderData() {
        console.log('setsenderData is called...!!')
        console.log('account: ', account)
        if (state.contract) {
            console.log('contract is: ', state.contract)
            const senderTxIds =
                await state.contract.retrieveSenderSignaturesTxIds(account)
            console.log(senderTxIds)
            setSignedTxData([])
            await senderTxIds.forEach(async (id) => {
                const transaction = await state.contract.getTransactionById(id)
                setSignedTxData((prev) => [...prev, transaction])
            })
        }
    }

    async function setReceiverData() {
        if (state.contract) {
            const receiverTxIds =
                await state.contract.retrieveRecieverSignaturesTxIds(account)

            setReceivedTxData([])
            console.log('receiverTxIds', receiverTxIds)
            await receiverTxIds.forEach(async (id) => {
                const transaction = await state.contract.getTransactionById(id)
                setReceivedTxData((prev) => [...prev, transaction])
            })
        }
    }

    async function getSignerAddress() {
        const msg = document.querySelector('#msg').value
        const signature = document.querySelector('#signature').value
        const signerAddress = await state.contract.getSigner(msg, signature)
        console.log('signature is', signerAddress)
        document.querySelector('#valid').innerHTML = `<h1>${signerAddress}</h1>`
    }

    return (
        <div className='bg-white min-h-screen max-h-full'>
        <div className='flex justify-between items-center bg-white shadow-md'>
            <div className='m-4 ml-8 text-2xl text-gray-800'>
                <span className='font-bold'>PRAMANIK</span>
            </div>
            <div className='mx-8 my-2'>
                <button
                    onClick={connectWallet}
                    id='connect_button'
                    className='bg-blue-500 text-white m-4 p-4 px-20 rounded-md shadow-md hover:bg-blue-600 hover:shadow-lg transition duration-200'
                >
                    Connect Wallet
                </button>
            </div>
        </div>

        {connected ? (
            <div>
              <div className="flex justify-start">
    <select
        className="text-2xl cursor-pointer m-4 p-2 rounded-md bg-gray-100 text-gray-800 hover:shadow-md hover:bg-gray-200 transition duration-200"
        value={page}
        onChange={(e) => {
            const selectedPage = e.target.value;
            setPage(selectedPage);
            if (selectedPage === 'data') {
                setSenderData();
                setReceiverData();
            }
        }}
    >
        <option value="sign">Issue Document</option>
        <option value="verify">Verify Document</option>
        <option value="data">Data</option>
    </select>
</div>

                {/* Sign Page */}
                  {/* <div className='md:w-1/2 p-4'>
                            <div className='text-2xl font-bold text-gray-800'>
                                Certificate Verification dApp
                            </div>
                            <div className='text-xl text-gray-600'>
                                This application solves the problem of certificate counterfeiting in today's world. Organizations can sign certificates using their private keys, and anyone can verify them using the provided signature, CID, and the public key of the signing organization.
                            </div>
                            <div className='text-xl underline font-semibold text-gray-800'>
                                Steps involved:
                            </div>
                            <ol className='list-decimal ml-4 list-outside text-xl text-gray-600'>
                                <li>Upload certificate to IPFS</li>
                                <li>Sign the generated CID using the organization's private key</li>
                                <li>Store the CID and signature on the blockchain along with the receiver's address and message</li>
                            </ol>
                        </div> */}
              {page === 'sign' && (
    <div className='flex justify-center items-center min-h-screen bg-gray-50'>
        <div className='flex flex-col w-full max-w-4xl bg-white rounded-lg shadow-lg p-8'>
            <h2 className='text-2xl font-bold mb-6 text-center'>Sign and Save Certificate</h2>
            
            {/* Step 1: Upload File */}
            <div className='flex flex-col mb-6'>
                <h3 className='text-lg font-semibold mb-2'>Upload the File</h3>
                {cid ? (
                    <div className='p-4 bg-gray-100 rounded-md'>
                        <span className='font-semibold'>CID: </span>{cid}
                    </div>
                ) : (
                    <div className='flex flex-col md:flex-row items-center gap-4'>
                        <input
                            type='file'
                            id='file'
                            className='border border-gray-300 p-2 rounded-md'
                        />
                        <button
                            onClick={uploadImg}
                            className='bg-blue-500 text-white px-6 py-2 rounded-md shadow-md hover:bg-blue-600 hover:shadow-lg transition duration-200'
                        >
                            Upload to IPFS
                        </button>
                    </div>
                )}
            </div>

            {/* Step 2: Sign the CID */}
            <div className='flex flex-col mb-6'>
                <h3 className='text-lg font-semibold mb-2'>Sign the CID(Issuing Authority Signature)</h3>
                {signature ? (
                    <div className='flex items-center p-4 bg-gray-100 rounded-md'>
                        <span className='font-mono break-all w-full'>{signature.slice(0, 20)}...</span>
                        <div
                            onClick={async () => await navigator.clipboard.writeText(signature)}
                            className='cursor-pointer text-blue-500 ml-2'
                        >
                            <AiOutlineCopy size={20} />
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={getSignature}
                        className='bg-blue-500 text-white px-6 py-3 rounded-md shadow-md w-full hover:bg-blue-600 hover:shadow-lg transition duration-200'
                    >
                        Sign the CID
                    </button>
                )}
            </div>

            {/* Step 3: Enter Details */}
            <div className='flex flex-col mb-6'>
                <h3 className='text-lg font-semibold mb-2'>Enter Receiver and Certificate Details</h3>
                <input
                    type='text'
                    className='border border-gray-300 p-2 rounded-md mb-4'
                    placeholder='Receiver address (e.g., 0xed7852...)'
                    id='receiver'
                />
                <input
                    type='text'
                    className='border border-gray-300 p-2 rounded-md mb-4'
                    placeholder='Certificate data'
                    id='message'
                />
            </div>

            {/* Step 4: Save to Blockchain */}
            <div className='flex flex-col'>
                <h3 className='text-lg font-semibold mb-2'>Issue Document:-</h3>
                {signature && (
                    <button
                        onClick={saveData}
                        className='bg-green-500 text-white px-6 py-3 rounded-md shadow-md hover:bg-green-600 hover:shadow-lg transition duration-200 w-full'
                    >
                        Save
                    </button>
                )}
            </div>
        </div>
    </div>
)}
 
 {/* <div className='max-w-screen-sm'>
                              <div className='font-bold text-2xl'>
                                    Verify certificate's authenticity
                                </div> 
                                <div className='text-xl'>
                                    <span className=' underline font-semibold'>
                                        steps involved:
                                    </span>
                                    <ol className='list-decimal list-outside ml-4'>
                                        <li>
                                            get the cid and the signature of the
                                            signer from the data section
                                        </li>
                                        <li>
                                            paste the cid and signature in the
                                            provided input fields
                                        </li>
                                        <li>
                                            If you have address of the
                                            organization as well, choose the
                                            option given below and paste the
                                            organization's address as well
                                        </li>
                                        <li>
                                            hit the button to get the signing
                                            authority in case you didn't
                                            provided the address and the boolean
                                            value in case you provided the
                                            certificate as well
                                        </li>
                                    </ol>
                                </div>
                            </div> */}
                    {page === 'verify' && (
    <div className='flex justify-center items-center min-h-screen bg-gray-50'>
        <div className='flex flex-col w-full max-w-4xl bg-white rounded-lg shadow-lg p-8'>
            <h2 className='text-2xl font-bold mb-6 text-center'>Verify Signature</h2>
            
            {/* CID Input */}
            <div className='flex flex-col mb-6'>
                <h3 className='text-lg font-semibold mb-2'>Enter CID</h3>
                <div className='flex flex-row items-center gap-4'>
                    <label htmlFor='msg' className='text-lg font-medium'>
                        CID:
                    </label>
                    <input
                        type='text'
                        id='msg'
                        className='border border-gray-300 p-2 rounded-md flex-1'
                        placeholder='Signed message'
                    />
                </div>
            </div>

            {/* Signature Input */}
            <div className='flex flex-col mb-6'>
                <h3 className='text-lg font-semibold mb-2'>Enter Signature</h3>
                <div className='flex flex-row items-center gap-4'>
                    <label htmlFor='signature' className='text-lg font-medium'>
                        Signature:
                    </label>
                    <input
                        type='text'
                        id='signature'
                        className='border border-gray-300 p-2 rounded-md flex-1'
                        placeholder='Signature'
                    />
                </div>
            </div>

            {/* Signer Address Input */}
            {showSignerInput && (
                <div className='flex flex-col mb-6'>
                    <h3 className='text-lg font-semibold mb-2'>
                        Enter Signer Address
                    </h3>
                    <div className='flex flex-row items-center gap-4'>
                        <label htmlFor='signer' className='text-lg font-medium'>
                            Signer Address:
                        </label>
                        <input
                            type='text'
                            id='signer'
                            className='border border-gray-300 p-2 rounded-md flex-1'
                            placeholder='Signing authority'
                        />
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className='flex flex-col items-center'>
                {!showSignerInput ? (
                    <button
                        onClick={getSignerAddress}
                        className='bg-blue-500 text-white px-6 py-3 rounded-md shadow-md w-full max-w-md hover:bg-blue-600 hover:shadow-lg transition duration-200 mb-4'
                    >
                        Get the Signer Address
                    </button>
                ) : (
                    <button
                        onClick={checkValidity}
                        className='bg-green-500 text-white px-6 py-3 rounded-md shadow-md w-full max-w-md hover:bg-green-600 hover:shadow-lg transition duration-200 mb-4'
                    >
                        Confirm Address Validity
                    </button>
                )}
                <div id='valid' className='text-xl font-medium text-gray-700'></div>
            </div>

            {/* Toggle Option */}
            <div className='text-center'>
                {!showSignerInput ? (
                    <span
                        className='text-sm text-blue-500 cursor-pointer'
                        onClick={() => setShowSignerInput(true)}
                    >
                        Already have the signer address? Try this
                    </span>
                ) : (
                    <span
                        className='text-sm text-blue-500 cursor-pointer'
                        onClick={() => setShowSignerInput(false)}
                    >
                        Don’t have the signer address? Click here
                    </span>
                )}
            </div>
        </div>
    </div>
)}


{page === 'data' && (
                <div className='w-full px-8 py-4'>
                    <div className='text-xl font-bold mb-4'>Document Details</div>
                    <div className='overflow-x-auto'>
                        <table className='table-auto w-full border-collapse border border-gray-300'>
                            <thead className='bg-gray-100'>
                                <tr>
                                    <th className='border border-gray-300 px-4 py-2'>Type</th>
                                    <th className='border border-gray-300 px-4 py-2'>Timestamp</th>
                                    <th className='border border-gray-300 px-4 py-2'>Sender/Receiver</th>
                                    <th className='border border-gray-300 px-4 py-2'>CID</th>
                                    <th className='border border-gray-300 px-4 py-2'>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    ...signedTxData.map((tx) => ({
                                        ...tx,
                                        type: 'Signed',
                                    })),
                                    ...receivedTxData.map((tx) => ({
                                        ...tx,
                                        type: 'Received',
                                    })),
                                ].map((tx, index) => (
                                    <tr
                                        key={index}
                                        className={`border border-gray-300 hover:bg-gray-50 ${
                                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                        }`}
                                    >
                                        <td className='border border-gray-300 px-4 py-2'>{tx.type}</td>
                                        <td className='border border-gray-300 px-4 py-2'>
                                            {new Date(tx.timestamp).toLocaleString()}
                                        </td>
                                        <td className='border border-gray-300 px-4 py-2'>{tx.sender}</td>
                                        <td className='border border-gray-300 px-4 py-2'>{tx.cid}</td>
                                        <td className='border border-gray-300 px-4 py-2 text-center'>
                                            <button
                                                className='bg-blue-500 text-white px-4 py-1 rounded-lg hover:bg-blue-600'
                                                onClick={() => setSelectedTx(tx)}
                                            >
                                                More Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {selectedTx && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
                    <div className='bg-white p-6 rounded-lg w-11/12 md:w-1/2'>
                        <div className='text-xl font-semibold mb-4'>Transaction Details</div>
                        <div className='space-y-2'>
                            <div>
                                <strong>Type:</strong> {selectedTx.type}
                            </div>
                            <div>
                                <strong>Timestamp:</strong>{' '}
                                {new Date(selectedTx.timestamp).toLocaleString()}
                            </div>
                            <div>
                                <strong>Sender/Receiver:</strong> {selectedTx.sender}
                            </div>
                            <div>
                                <strong>Signature:</strong>{' '}
                                <span className='break-all'>{selectedTx.signature}</span>
                            </div>
                            <div>
                                <strong>CID:</strong> {selectedTx.cid}
                            </div>
                            <div>
                                <strong>Message:</strong> {selectedTx.message}
                            </div>
                        </div>
                        <div className='mt-4 flex justify-end'>
                            <button
                                className='bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600'
                                onClick={closeModal}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

                </div>
            ) : (
                <div className='text-3xl font-semibold flex justify-center'>
                    Please connect the wallet first!!
                </div>
            )}
            <ToastContainer />
        </div>
    )
}

export default Data
